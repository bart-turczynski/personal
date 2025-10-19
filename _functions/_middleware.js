// functions/_middleware.js
export async function onRequest(context) {
  const url = new URL(context.request.url);
  let changed = false;

  // 1) www → apex
  if (url.hostname === "www.turczynski.pl") {
    url.hostname = "turczynski.pl";
    changed = true;
  }

  // 2) remove trailing slash (but keep the homepage "/")
  if (url.pathname.endsWith("/") && url.pathname !== "/") {
    url.pathname = url.pathname.slice(0, -1);
    changed = true;
  }

  // If anything changed, 301 to the canonical URL (keeps query string)
  if (changed) return Response.redirect(url.toString(), 301);

  // Otherwise continue to your static asset
  return context.next();
}