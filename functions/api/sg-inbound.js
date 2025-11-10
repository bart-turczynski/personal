const textPreview = (s = "", max = 240) => {
  if (!s) return "";
  const clean = String(s).replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max) + "…" : clean;
};

const truncate = (v, n = 4096) => {
  if (v == null) return null;
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > n ? s.slice(0, n) + "…" : s;
};

const extractUrls = (s = "") => {
  const re = /(https?:\/\/[^\s\)\]\">]+)/gi;
  const out = [];
  let m;
  while ((m = re.exec(s))) out.push(m[0]);
  return Array.from(new Set(out)).slice(0, 50);
};

const scoreEmail = ({ spamScore, spf, dkim, urls = [], attachments = [], subject = "", text = "" }) => {
  let score = 20;
  if (typeof spamScore === "number") score += Math.min(Math.max(spamScore * 10, 0), 40); // spamassassin 4.0 => up to +40
  if (spf && /fail/i.test(spf)) score += 25;
  if (dkim && /fail|none/i.test(dkim)) score += 15;
  if (urls.length >= 3) score += 15;
  if (urls.length >= 6) score += 25;
  const badSubj = /(viagra|loan|casino|crypto|sex|nude|won|invoice|overdue)/i.test(subject || "");
  if (badSubj) score += 20;
  const badBody = /(btc|usdt|porn|hack|ransom|urgent|wire|gift\s?card)/i.test(text || "");
  if (badBody) score += 15;
  const dangerous = attachments.filter((a) => /\.(exe|js|vbs|scr|bat|cmd|ps1|jar|xlsm|docm|zip|rar)$/i.test(a.name || ""));
  if (dangerous.length) score += 30;
  return Math.max(0, Math.min(score, 100));
};

const sendEmail = async (env, { subject, text }) => {
  const provider = (env?.MAIL_PROVIDER || "").toUpperCase();
  const apiKey = env?.MAIL_API_KEY;
  const to = env?.ALERTS_TO;
  const from = env?.ALERTS_FROM || to;
  if (!to || !from || !provider) return;

  if (provider === "RESEND") {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
  } else if (provider === "SENDGRID") {
    await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from },
        subject,
        content: [{ type: "text/plain", value: text }],
      }),
    });
  }
};

export const onRequest = async ({ request, env, waitUntil }) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const inboundSecret = env?.INBOUND_SECRET;
  if (inboundSecret) {
    const provided = request.headers.get("x-inbound-secret") || url.searchParams.get("secret");
    if (provided !== inboundSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
  }

  const ct = request.headers.get("content-type") || "";
  if (!ct.toLowerCase().includes("multipart/form-data")) {
    return new Response(JSON.stringify({ error: "Expected multipart/form-data" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  let form;
  try {
    form = await request.formData();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Bad form data" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  const get = (k) => form.get(k);
  const envelope = (() => {
    try {
      return JSON.parse(get("envelope") || "{}");
    } catch { return {}; }
  })();

  const from = get("from") || envelope?.from;
  const to = get("to") || (Array.isArray(envelope?.to) ? envelope.to.join(",") : envelope?.to);
  const subject = get("subject") || "";
  const text = get("text") || "";
  const html = get("html") || "";
  const spamScore = Number(get("spam_score")) || null;
  const spf = get("SPF") || get("spf");
  const dkim = get("dkim");
  const remoteIp = envelope?.remote_ip || get("sender_ip") || null;
  const headersRaw = get("headers");

  const attachments = [];
  for (const [key, val] of form.entries()) {
    if (val && typeof val === "object" && "name" in val) {
      attachments.push({ key, name: val.name, type: val.type, size: val.size });
    }
  }

  const urls = extractUrls(String(text) + "\n" + String(html));
  const score = scoreEmail({ spamScore, spf, dkim, urls, attachments, subject, text });
  const classification = score >= 80 ? "suspicious" : "observed";

  // Persist to D1 if available
  if (env && env.DB && typeof env.DB.prepare === "function") {
    try {
      await env.DB.prepare(
        `INSERT INTO events (ts, ip, country, colo, asn, path, form_id, honey, score, class, ua, cf_ray, fields_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          new Date().toISOString(),
          remoteIp,
          null,
          null,
          null,
          "/sg-inbound",
          "sendgrid",
          0,
          score,
          classification,
          null,
          null,
          JSON.stringify({ from, to, subject, urls, spamScore, spf, dkim, attachments })
        )
        .run();
    } catch (e) {
      console.error("sg-inbound: d1 insert failed", e);
    }
  }

  // Alert email with triage hints
  const shouldAlert = score >= Number(env?.ALERT_THRESHOLD || 60);
  if (shouldAlert && env?.ALERTS_TO) {
    const subjectLine = `[intake-email] ${classification.toUpperCase()} score ${score} — ${remoteIp || "?"} — ${textPreview(subject, 80)}`;
    const lines = [
      `event=email-parse provider=sendgrid`,
      `from=${truncate(from, 200)}`,
      `to=${truncate(to, 200)}`,
      `ip=${remoteIp || "?"} spf=${spf || "-"} dkim=${dkim || "-"} spam=${spamScore ?? "-"}`,
      `subject=${textPreview(subject, 160)}`,
      urls.length ? `urls=${urls.slice(0,5).join(" ")}` : null,
      attachments.length ? `attachments=${attachments.map(a=>`${a.name}(${a.size})`).slice(0,3).join(", ")}` : null,
      `preview=${textPreview(text || html, 200)}`,
    ].filter(Boolean).join("\n");
    const p = sendEmail(env, { subject: subjectLine, text: lines });
    if (typeof waitUntil === "function") waitUntil(p);
  }

  return new Response(JSON.stringify({ status: "received" }), { status: 202, headers: { "content-type": "application/json" } });
};
