// functions/_middleware.js
export async function onRequest(context) {
  const url = new URL(context.request.url); // <-- define inside handler
  let changed = false;

  // 1) Force apex (www → no-www)
  if (url.hostname === "www.turczynski.pl") {
    url.hostname = "turczynski.pl";
    changed = true;
  }

  // 2) Remove trailing slash (but keep the homepage "/")
  if (url.pathname.endsWith("/") && url.pathname !== "/") {
    url.pathname = url.pathname.slice(0, -1);
    changed = true;
  }

  // If normalized, 301 to the canonical URL (preserves query string)
  if (changed) {
    return Response.redirect(url.toString(), 301);
  }

  // Otherwise continue to the static asset
  return context.next();
}