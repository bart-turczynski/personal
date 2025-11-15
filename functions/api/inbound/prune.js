const respond = (status, data) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      Allow: "POST",
    },
  });

const getRetentionDays = (request, env) => {
  const url = new URL(request.url);
  const raw = url.searchParams.get("days") || env?.RETENTION_DAYS || "14";
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 14;
  return Math.min(Math.round(parsed), 365);
};

export const onRequest = async ({ request, env }) => {
  if (request.method !== "POST") {
    return respond(405, { error: "Method not allowed", allowed: ["POST"] });
  }

  const secret = env?.PRUNE_SECRET;
  const provided =
    request.headers.get("x-prune-secret") ||
    request.headers.get("x-digest-secret") ||
    new URL(request.url).searchParams.get("secret");
  if (!secret || provided !== secret) {
    return respond(401, { error: "Unauthorized" });
  }

  if (!env?.DB || typeof env.DB.prepare !== "function") {
    return respond(500, { error: "D1 binding missing" });
  }

  const retentionDays = getRetentionDays(request, env);
  const windowExpr = `-${retentionDays} days`;
  const nowIso = new Date().toISOString();

  try {
    const summaryStmt = env.DB.prepare(
      `SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN honey = 1 THEN 1 ELSE 0 END) AS honey,
          MIN(ts) AS oldest,
          MAX(ts) AS newest
        FROM events
        WHERE ts < datetime('now', ?)`
    );
    const summary = (await summaryStmt.bind(windowExpr).first()) || {
      total: 0,
      honey: 0,
      oldest: null,
      newest: null,
    };

    const classBreakdownStmt = env.DB.prepare(
      `SELECT class, COUNT(*) AS count
         FROM events
        WHERE ts < datetime('now', ?)
        GROUP BY class`
    );
    const classBreakdown = await classBreakdownStmt.bind(windowExpr).all();

    const deleteStmt = env.DB.prepare(`DELETE FROM events WHERE ts < datetime('now', ?)`);
    const deleteResult = await deleteStmt.bind(windowExpr).run();
    const deleted = deleteResult?.meta?.changes ?? 0;

    await env.DB.prepare(
      `INSERT INTO retention_log (ran_at, retention_days, deleted_rows, oldest_deleted_ts, newest_deleted_ts)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(nowIso, retentionDays, deleted, summary.oldest, summary.newest)
      .run();

    return respond(200, {
      ok: true,
      ranAt: nowIso,
      retentionDays,
      deleted,
      summary,
      classBreakdown,
    });
  } catch (error) {
    console.error("retention prune failed", error);
    return respond(500, { error: "Retention run failed", details: String(error) });
  }
};
