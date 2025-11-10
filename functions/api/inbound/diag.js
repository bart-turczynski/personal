const checkDb = async (env) => {
  const result = { bound: false, canQuery: false, rowsLastHour: 0 };
  if (!env || !env.DB || typeof env.DB.prepare !== "function") return result;
  result.bound = true;
  try {
    const row = await env.DB.prepare("SELECT COUNT(*) AS c FROM events WHERE ts >= datetime('now','-1 hour')").first();
    result.canQuery = true;
    result.rowsLastHour = Number(row?.c || 0);
  } catch {
    result.canQuery = false;
  }
  return result;
};

const sendEmail = async (env, subject, text) => {
  const provider = (env?.MAIL_PROVIDER || "").toUpperCase();
  const apiKey = env?.MAIL_API_KEY;
  const to = env?.ALERTS_TO;
  const from = env?.ALERTS_FROM || to;
  if (!to || !from || !provider) return { ok: false, reason: "missing-config" };

  try {
    if (provider === "RESEND") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ from, to: [to], subject, text }),
      });
      return { ok: res.ok, status: res.status };
    } else if (provider === "SENDGRID") {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: from },
          subject,
          content: [{ type: "text/plain", value: text }],
        }),
      });
      return { ok: res.ok, status: res.status };
    }
    return { ok: false, reason: "unsupported-provider" };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
};

export const onRequest = async ({ request, env }) => {
  const url = new URL(request.url);
  const secret = env?.DIGEST_SECRET;
  const provided = request.headers.get("x-digest-secret") || url.searchParams.get("secret");
  if (!secret || provided !== secret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  }

  const db = await checkDb(env);
  let email = { configured: Boolean(env?.MAIL_PROVIDER && env?.ALERTS_TO), result: null };

  if (url.searchParams.get("send") === "1") {
    email.result = await sendEmail(env, "intake diag", `db.bound=${db.bound} db.canQuery=${db.canQuery}`);
  }

  return new Response(JSON.stringify({ ok: true, db, email }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
};

