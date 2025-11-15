const MAX_BODY_BYTES = 16_384;

const truncate = (value = "", limit = 512) => {
  if (typeof value !== "string") return String(value).slice(0, limit);
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
};

const normaliseReport = (payload = {}) => {
  const body = payload["csp-report"] || payload.report || payload;
  return {
    "document-uri": truncate(body["document-uri"]),
    "referrer": truncate(body["referrer"]),
    "blocked-uri": truncate(body["blocked-uri"]),
    "violated-directive": truncate(body["violated-directive"]),
    "original-policy": truncate(body["original-policy"], 2048),
    "source-file": truncate(body["source-file"]),
    "line-number": body["line-number"] || null,
    "column-number": body["column-number"] || null,
    disposition: truncate(body["disposition"]),
    "effective-directive": truncate(body["effective-directive"]),
    "status-code": body["status-code"] || null,
    "sample": truncate(body["script-sample"], 256) || truncate(body["sample"], 256) || null,
  };
};

const methodNotAllowed = () =>
  new Response("Not Found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });

export const onRequest = async ({ request, env }) => {
  if (request.method !== "POST") return methodNotAllowed();

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return new Response(JSON.stringify({ status: "ignored", reason: "unsupported content-type" }), {
      status: 415,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  let json;
  try {
    const bodyString = await request.text();
    if (bodyString.length > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ status: "error", reason: "payload too large" }), {
        status: 413,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    }
    json = JSON.parse(bodyString || "{}");
  } catch (err) {
    console.error("csp: invalid json payload", err);
    return new Response(JSON.stringify({ status: "error", reason: "invalid json" }), {
      status: 400,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  const report = normaliseReport(json);
  const metadata = {
    event: "csp-report",
    received_at: new Date().toISOString(),
    user_agent: truncate(request.headers.get("user-agent") || ""),
    ray_id: request.headers.get("cf-ray") || null,
    colo: request.cf?.colo || null,
    report,
  };

  console.warn("csp-report", metadata);

  if (env && env.DB && typeof env.DB.prepare === "function") {
    try {
      const stmt = env.DB.prepare(
        `INSERT INTO csp_reports (ts, ray_id, colo, ua, document_uri, blocked_uri, violated_directive, original_policy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      await stmt
        .bind(
          metadata.received_at,
          metadata.ray_id,
          metadata.colo,
          metadata.user_agent,
          report["document-uri"] || null,
          report["blocked-uri"] || null,
          report["violated-directive"] || null,
          report["original-policy"] || null
        )
        .run();
    } catch (error) {
      console.error("csp: failed to persist report", error);
    }
  }

  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
};
