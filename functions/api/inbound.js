const truncate = (value = "", limit = 4096) => {
  if (typeof value !== "string") return String(value);
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
};

const normaliseFieldEntries = (formData) => {
  const fields = {};
  for (const [key, rawValue] of formData.entries()) {
    let value = rawValue;
    if (typeof rawValue === "object" && rawValue !== null && "name" in rawValue) {
      const fileMeta = { name: rawValue.name, type: rawValue.type, size: rawValue.size };
      value = `[file:${JSON.stringify(fileMeta)}]`;
    }
    if (fields[key]) {
      if (Array.isArray(fields[key])) fields[key].push(truncate(value));
      else fields[key] = [fields[key], truncate(value)];
    } else {
      fields[key] = truncate(value);
    }
  }
  return fields;
};

const calculateScore = ({ honeyTripped, cfThreatScore, notes = "" }) => {
  let score = 10;
  if (honeyTripped) score += 60;
  if (cfThreatScore) score += Math.min(cfThreatScore, 20);
  if (notes && notes.length > 280) score += 10;
  if (notes && /http(s)?:\/\//i.test(notes)) score += 10;
  return Math.min(score, 100);
};

export const onRequest = async (ctx) => {
  const { request, env, waitUntil } = ctx;
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed", allowed: ["POST"] }), {
      status: 405,
      headers: { "content-type": "application/json", Allow: "POST", "cache-control": "no-store" },
    });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch (error) {
    console.error("inbound: invalid form payload", error);
    return new Response(JSON.stringify({ status: "error", message: "Invalid form payload" }), {
      status: 400,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  const fields = normaliseFieldEntries(formData);
  const honeyTokenRaw = formData.get("honey_token");
  const honeyTripped = Boolean(honeyTokenRaw && honeyTokenRaw.toString().trim().length);
  const cf = request.cf || {};

  const metadata = {
    event: "web-intake",
    timestamp: new Date().toISOString(),
    path: new URL(request.url).pathname,
    formId: formData.get("form_id") || null,
    honeyTripped,
    cfRay: request.headers.get("cf-ray") || null,
    ip: request.headers.get("cf-connecting-ip") || null,
    country: cf.country || null,
    colo: cf.colo || null,
    asn: cf.asn || null,
    userAgent: request.headers.get("user-agent") || null,
    referer: request.headers.get("referer") || null,
    threatScore: cf.threatScore || null,
    fields,
  };

  const noteSource = fields.notes || fields.summary || "";
  const normalisedNotes = Array.isArray(noteSource) ? noteSource.join(" ") : noteSource;

  const score = calculateScore({ honeyTripped, cfThreatScore: cf.threatScore, notes: normalisedNotes });
  const classification = honeyTripped ? "honeypot" : score >= 60 ? "suspicious" : "observed";

  // Persist to D1 if bound
  if (env && env.DB && typeof env.DB.prepare === "function") {
    try {
      const stmt = env.DB.prepare(
        `INSERT INTO events (ts, ip, country, colo, asn, path, form_id, honey, score, class, ua, cf_ray, fields_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      await stmt
        .bind(
          metadata.timestamp,
          metadata.ip,
          metadata.country,
          metadata.colo,
          metadata.asn ?? null,
          metadata.path,
          metadata.formId,
          honeyTripped ? 1 : 0,
          score,
          classification,
          metadata.userAgent,
          metadata.cfRay,
          JSON.stringify(fields)
        )
        .run();
    } catch (e) {
      console.error("inbound: d1 insert failed", e);
    }
  }

  // Email alert (configurable). Supports RESEND or SENDGRID via env variables.
  const shouldAlert = classification === "honeypot" || score >= Number(env?.ALERT_THRESHOLD || 60);
  const alertsTo = env?.ALERTS_TO || ""; // e.g., alerts@turczynski.pl
  const alertsFrom = env?.ALERTS_FROM || alertsTo;
  const provider = (env?.MAIL_PROVIDER || "").toUpperCase(); // RESEND, SENDGRID, MAILCHANNELS
  const apiKey = env?.MAIL_API_KEY; // not required for MAILCHANNELS

  const sendEmail = async ({ subject, text }) => {
    if (!alertsTo || !alertsFrom || !provider || !apiKey) return;
    try {
      if (provider === "RESEND") {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ from: alertsFrom, to: [alertsTo], subject, text }),
        });
        if (!res.ok) throw new Error(`resend http ${res.status}`);
      } else if (provider === "SENDGRID") {
        const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: alertsTo }] }],
            from: { email: alertsFrom },
            subject,
            content: [{ type: "text/plain", value: text }],
          }),
        });
        if (!res.ok) throw new Error(`sendgrid http ${res.status}`);
      } else if (provider === "MAILCHANNELS") {
        // MailChannels has no API key; use domain reputation + optional header
        const res = await fetch("https://api.mailchannels.net/tx/v1/send", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            // Helps MailChannels attribute sending to your domain
            "X-Auth-User": alertsFrom,
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: alertsTo }] }],
            from: { email: alertsFrom },
            subject,
            content: [{ type: "text/plain", value: text }],
          }),
        });
        if (!res.ok) throw new Error(`mailchannels http ${res.status}`);
      }
    } catch (e) {
      console.error("inbound: email alert failed", e);
    }
  };

  if (shouldAlert) {
    let allowSend = true;
    const cap = Number(env?.ALERT_HOURLY_CAP || 20);
    const dedupMins = Number(env?.ALERT_DEDUP_WINDOW_MIN || 60);

    if (env && env.DB && typeof env.DB.prepare === "function") {
      try {
        // Hourly cap based on high-score events in the last hour
        const capStmt = env.DB.prepare(
          `SELECT COUNT(*) AS c
             FROM events
            WHERE ts >= datetime('now','-1 hour')
              AND (honey = 1 OR score >= ?)`
        );
        const { c } = await capStmt.bind(Number(env?.ALERT_THRESHOLD || 60)).first();
        if (typeof c === "number" && c >= cap) allowSend = false;

        // Deduplicate by IP within window
        if (allowSend && metadata.ip) {
          const dedupStmt = env.DB.prepare(
            `SELECT 1 AS x
               FROM events
              WHERE ts >= datetime('now', ?)
                AND ip = ?
                AND (honey = 1 OR score >= ?)
              LIMIT 1`
          );
          const row = await dedupStmt.bind(`-${dedupMins} minutes`, metadata.ip, Number(env?.ALERT_THRESHOLD || 60)).first();
          if (row && row.x === 1) allowSend = false;
        }
      } catch (e) {
        console.error("inbound: cap/dedup check failed", e);
      }
    }

    if (allowSend) {
      const subject = `[intake] ${classification.toUpperCase()} score ${score} — ${metadata.ip || "?"}`;
      const lines = [
        `event=web-intake`,
        `ts=${metadata.timestamp}`,
        `score=${score} class=${classification}`,
        `ip=${metadata.ip || "?"} country=${metadata.country || "??"} asn=${metadata.asn || "?"}`,
        `path=${metadata.path} form=${metadata.formId || "?"}`,
        metadata.cfRay ? `ray=${metadata.cfRay}` : null,
        `ua=${(metadata.userAgent || "-").slice(0, 300)}`,
      ].filter(Boolean);
      const text = lines.join("\n");
      const promise = sendEmail({ subject, text });
      if (typeof waitUntil === "function") waitUntil(promise);
    } else {
      console.log("inbound: alert suppressed (cap/dedup)");
    }
  }

  console.log(JSON.stringify({ ...metadata, score, classification }));

  // Minimal response: acknowledge only, no details
  return new Response(JSON.stringify({ status: "received" }), {
    status: 202,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
};
