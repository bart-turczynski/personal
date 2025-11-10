export const onRequest = async (ctx) => {
  const { request, env } = ctx;
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const now = new Date().toISOString();
  const ip = payload.ip || payload.remote_ip || null;
  const asn = payload.asn || null;
  const country = payload.country || null;
  const helo = payload.helo || null;
  const mailFrom = payload.mail_from || null;
  const rcptTo = Array.isArray(payload.rcpt_to) ? payload.rcpt_to.join(",") : payload.rcpt_to || null;
  const subject = payload.subject || null;
  const size = Number(payload.size || payload.message_size || 0) || 0;

  // Basic scoring for SMTP sink
  let score = 20;
  if (payload.spf === "fail") score += 30;
  if (subject && /(viagra|loan|crypto|casino)/i.test(subject)) score += 30;
  if (size > 5_000_000) score += 10; // large payload
  score = Math.min(score, 100);

  const record = {
    event: "smtp-intake",
    timestamp: now,
    ip,
    asn,
    country,
    helo,
    mailFrom,
    rcptTo,
    subject,
    size,
    score,
  };

  // Persist to D1 if available
  if (env && env.DB && typeof env.DB.prepare === "function") {
    try {
      const stmt = env.DB.prepare(
        `INSERT INTO events (ts, ip, country, colo, asn, path, form_id, honey, score, class, ua, cf_ray, fields_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      await stmt
        .bind(
          now,
          ip,
          country,
          null,
          asn ?? null,
          "/smtp-ingest",
          "smtp",
          0,
          score,
          score >= 60 ? "suspicious" : "observed",
          helo,
          null,
          JSON.stringify({ mailFrom, rcptTo, subject, size })
        )
        .run();
    } catch (e) {
      console.error("smtp-ingest: d1 insert failed", e);
    }
  }

  return new Response(JSON.stringify({ status: "received" }), {
    status: 202,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
};

