const sendEmail = async (env, { subject, text }) => {
  const provider = (env?.MAIL_PROVIDER || "").toUpperCase();
  const apiKey = env?.MAIL_API_KEY;
  const to = env?.ALERTS_TO;
  const from = env?.ALERTS_FROM || to;
  if (!to || !from || !provider) return;

  if (provider === "RESEND") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!res.ok) throw new Error(`resend http ${res.status}`);
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
    if (!res.ok) throw new Error(`sendgrid http ${res.status}`);
  }
};

export const onRequest = async ({ request, env }) => {
  const url = new URL(request.url);
  const secret = env?.DIGEST_SECRET;
  const provided = request.headers.get("x-digest-secret") || url.searchParams.get("secret");
  if (!secret || provided !== secret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  }

  const hours = Number(url.searchParams.get("hours") || 24);
  const threshold = Number(env?.ALERT_THRESHOLD || 60);

  let totals = { total: 0, honey: 0, suspicious: 0 };
  let topIps = [];
  let recent = [];

  if (env && env.DB && typeof env.DB.prepare === "function") {
    const totalStmt = env.DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN honey=1 THEN 1 ELSE 0 END) AS honey,
              SUM(CASE WHEN honey=0 AND score>=? THEN 1 ELSE 0 END) AS suspicious
         FROM events
        WHERE ts >= datetime('now', ?)`
    );
    totals = (await totalStmt.bind(threshold, `-${hours} hours`).first()) || totals;

    const topStmt = env.DB.prepare(
      `SELECT ip, COUNT(*) AS c
         FROM events
        WHERE ts >= datetime('now', ?) AND (honey=1 OR score>=?) AND ip IS NOT NULL
        GROUP BY ip
        ORDER BY c DESC
        LIMIT 10`
    );
    topIps = await topStmt.bind(`-${hours} hours`, threshold).all();

    const recentStmt = env.DB.prepare(
      `SELECT ts, ip, score, class, form_id AS form
         FROM events
        WHERE ts >= datetime('now', ?) AND (honey=1 OR score>=?)
        ORDER BY ts DESC
        LIMIT 10`
    );
    recent = await recentStmt.bind(`-${hours} hours`, threshold).all();
  }

  const asText = () => {
    const lines = [];
    lines.push(`intake digest — last ${hours}h`);
    lines.push(`total=${totals.total || 0} honey=${totals.honey || 0} suspicious=${totals.suspicious || 0}`);
    lines.push("");
    lines.push("top IPs:");
    for (const row of topIps || []) {
      lines.push(`  ${row.ip || "?"} — ${row.c}`);
    }
    lines.push("");
    lines.push("recent:");
    for (const r of recent || []) {
      lines.push(`  ${r.ts} ${r.ip || "?"} score=${r.score} ${r.class}/${r.form || "-"}`);
    }
    return lines.join("\n");
  };

  if (url.searchParams.get("send") === "1") {
    try {
      await sendEmail(env, { subject: `intake digest — last ${hours}h`, text: asText() });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { "content-type": "application/json" } });
    }
  }

  return new Response(
    JSON.stringify({ ok: true, totals, topIps, recent }),
    { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } }
  );
};

