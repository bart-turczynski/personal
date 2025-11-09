export async function onRequest(context) {
  const { request, next } = context;
  const start = Date.now();

  const url = new URL(request.url);
  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname;

  const trapHosts = new Set(["contact.turczynski.pl", "email.turczynski.pl"]);

  // Serve a minimal noindex landing page for trap subdomain roots
  if ((request.method === "GET" || request.method === "HEAD") && pathname === "/" && trapHosts.has(hostname)) {
    const isContact = hostname === "contact.turczynski.pl";
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OK</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;max-width:46rem;margin:12vh auto;padding:2rem;color:#0a0a0a;background:#fff}a{color:#06c}</style></head><body><h1>OK</h1><p>This endpoint is active.</p>${isContact ? '<p>Submit via <a href="/form/">/form/</a>.</p>' : ''}</body></html>`;
    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow",
      },
    });
  }

  const response = await next();

  // For trap pages and hosts, ensure noindex via header regardless of template meta
  const shouldNoindex =
    trapHosts.has(hostname) ||
    pathname.startsWith("/form/") ||
    pathname === "/form" ||
    pathname.startsWith("/api/inbound");

  let finalResponse = response;
  if (shouldNoindex) {
    const headers = new Headers(response.headers);
    headers.set("x-robots-tag", "noindex, nofollow");
    finalResponse = new Response(response.body, { status: response.status, headers });
  }

  console.log({
    host: hostname,
    path: pathname,
    status: finalResponse.status,
    latency_ms: Date.now() - start,
    colo: request.cf?.colo,
  });

  return finalResponse;
}
