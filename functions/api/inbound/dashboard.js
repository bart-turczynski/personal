const html = String.raw;

const respond = (status, body, contentType = "text/html; charset=utf-8") =>
  new Response(body, {
    status,
    headers: {
      "content-type": contentType,
      "cache-control": "no-store",
    },
  });

const escapeHtml = (value = "") =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const clampHours = (input) => {
  const parsed = Number(input);
  if (!Number.isFinite(parsed) || parsed <= 0) return 24;
  return Math.min(Math.round(parsed), 24 * 30); // max 30 days
};

const formatNumber = (value) => {
  const n = Number(value ?? 0);
  return n.toLocaleString("en-US");
};

const runAll = async (statement, ...bindArgs) => {
  const prepared = bindArgs.length ? statement.bind(...bindArgs) : statement;
  const result = await prepared.all();
  if (Array.isArray(result)) return result;
  return Array.isArray(result?.results) ? result.results : [];
};

const tableSection = ({ title, headers = [], rows = [] }) => {
  if (!rows?.length) return "";
  const headerHtml = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const rowsHtml = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("");
  return html`<section>
    <h2>${escapeHtml(title)}</h2>
    <div class="table-wrap">
      <table>
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  </section>`;
};

const renderRecent = (events = []) => {
  if (!events.length) return "<p>No recent events.</p>";
  return html`<section>
    <h2>Recent events</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>IP</th>
            <th>Country</th>
            <th>Form / Path</th>
            <th>Class</th>
            <th>Score</th>
            <th>Honey</th>
          </tr>
        </thead>
        <tbody>
          ${events
            .map((event) =>
              [
                event.ts,
                event.ip || "—",
                event.country || "—",
                event.form || event.path || "—",
                event.class || "—",
                event.score ?? "—",
                event.honey ? "yes" : "no",
              ]
                .map((cell) => `<td>${escapeHtml(cell)}</td>`)
                .join("")
            )
            .map((row) => `<tr>${row}</tr>`)
            .join("")}
        </tbody>
      </table>
    </div>
  </section>`;
};

const renderSummary = (summary, hours) => {
  const items = [
    { label: "Window", value: `${hours}h` },
    { label: "Total events", value: formatNumber(summary.total) },
    { label: "Honey hits", value: formatNumber(summary.honey) },
    { label: `Score ≥ ${summary.threshold}`, value: formatNumber(summary.suspicious) },
    { label: "Oldest within window", value: summary.oldest || "—" },
    { label: "Newest within window", value: summary.newest || "—" },
  ];
  const listItems = items.map((item) => `<li><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)}</li>`).join("");
  return `<section><h2>Summary</h2><ul class="summary">${listItems}</ul></section>`;
};

export const onRequest = async ({ request, env }) => {
  const url = new URL(request.url);
  const secret = env?.DIGEST_SECRET;
  const provided = request.headers.get("x-digest-secret") || url.searchParams.get("secret");
  if (!secret || provided !== secret) {
    return respond(401, JSON.stringify({ error: "Unauthorized" }), "application/json");
  }

  if (!env?.DB || typeof env.DB.prepare !== "function") {
    return respond(500, JSON.stringify({ error: "D1 binding missing" }), "application/json");
  }

  const debugMode = url.searchParams.get("debug") === "1";

  try {
  const hours = clampHours(url.searchParams.get("hours"));
  const threshold = Number(env?.ALERT_THRESHOLD || 60);
  const windowExpr = `-${hours} hours`;

  const totalsStmt = env.DB.prepare(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN honey=1 THEN 1 ELSE 0 END) AS honey,
            SUM(CASE WHEN score>=? THEN 1 ELSE 0 END) AS suspicious,
            MIN(ts) AS oldest,
            MAX(ts) AS newest
       FROM events
      WHERE ts >= datetime('now', ?)`
  );
  const summary = (await totalsStmt.bind(threshold, windowExpr).first()) || {
    total: 0,
    honey: 0,
    suspicious: 0,
    oldest: null,
    newest: null,
  };
  summary.threshold = threshold;

  const classStmt = env.DB.prepare(
    `SELECT class, COUNT(*) AS count
       FROM events
      WHERE ts >= datetime('now', ?)
      GROUP BY class
      ORDER BY count DESC`
  );
  const classRows = await runAll(classStmt, windowExpr);

  const formStmt = env.DB.prepare(
    `SELECT COALESCE(form_id, path, '(none)') AS label,
            COUNT(*) AS count,
            SUM(CASE WHEN honey=1 THEN 1 ELSE 0 END) AS honey
       FROM events
      WHERE ts >= datetime('now', ?)
      GROUP BY label
      ORDER BY count DESC
      LIMIT 10`
  );
  const topForms = await runAll(formStmt, windowExpr);

  const ipStmt = env.DB.prepare(
    `SELECT ip, COUNT(*) AS count
       FROM events
      WHERE ts >= datetime('now', ?) AND ip IS NOT NULL
      GROUP BY ip
      ORDER BY count DESC
      LIMIT 10`
  );
  const topIps = await runAll(ipStmt, windowExpr);

  const countryStmt = env.DB.prepare(
    `SELECT COALESCE(country,'??') AS country,
            COUNT(*) AS count
       FROM events
      WHERE ts >= datetime('now', ?)
      GROUP BY country
      ORDER BY count DESC
      LIMIT 10`
  );
  const topCountries = await runAll(countryStmt, windowExpr);

  const recentStmt = env.DB.prepare(
    `SELECT ts, ip, country, form_id AS form, path, class, score, honey
       FROM events
      WHERE ts >= datetime('now', ?)
      ORDER BY ts DESC
      LIMIT 40`
  );
  const recent = await runAll(recentStmt, windowExpr);

  const classTable = tableSection({
    title: "Classification breakdown",
    headers: ["Class", "Count"],
    rows: classRows.map((row) => [escapeHtml(row.class || "—"), escapeHtml(formatNumber(row.count))]),
  });

  const formTable = tableSection({
    title: "Top forms / paths",
    headers: ["Form or Path", "Total", "Honey Hits"],
    rows: topForms.map((row) => [
      escapeHtml(row.label || "—"),
      escapeHtml(formatNumber(row.count)),
      escapeHtml(formatNumber(row.honey || 0)),
    ]),
  });

  const ipTable = tableSection({
    title: "Top source IPs",
    headers: ["IP", "Count"],
    rows: topIps.map((row) => [escapeHtml(row.ip || "—"), escapeHtml(formatNumber(row.count))]),
  });

  const countryTable = tableSection({
    title: "Top countries",
    headers: ["Country", "Count"],
    rows: topCountries.map((row) => [escapeHtml(row.country || "??"), escapeHtml(formatNumber(row.count))]),
  });

  const htmlBody = html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Intake Dashboard</title>
        <style>
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            margin: 0 auto;
            padding: 2rem;
            max-width: 1200px;
            background: #f5f6fa;
            color: #101828;
          }
          h1,
          h2 {
            margin-top: 0;
          }
          section {
            margin-bottom: 2rem;
            background: #fff;
            padding: 1.5rem;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th,
          td {
            text-align: left;
            padding: 0.5rem;
            border-bottom: 1px solid rgba(226, 232, 240, 0.8);
          }
          th {
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: #475467;
          }
          tr:last-child td {
            border-bottom: none;
          }
          .summary {
            list-style: none;
            padding: 0;
            margin: 0;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 0.75rem;
          }
          .summary li {
            background: #f8fafc;
            border-radius: 8px;
            padding: 0.75rem 1rem;
            border: 1px solid #e2e8f0;
          }
          .table-wrap {
            overflow-x: auto;
          }
        </style>
      </head>
      <body>
        <h1>Intake Dashboard (last ${hours}h)</h1>
        ${renderSummary(summary, hours)} ${classTable} ${formTable} ${countryTable} ${ipTable} ${renderRecent(recent)}
      </body>
    </html>`;

  return respond(200, htmlBody);
  } catch (error) {
    console.error("dashboard error", error);
    if (debugMode) {
      return respond(500, JSON.stringify({ error: "dashboard-failed", details: String(error) }), "application/json");
    }
    return respond(500, JSON.stringify({ error: "Internal error" }), "application/json");
  }
};
