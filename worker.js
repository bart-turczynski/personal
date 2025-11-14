export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // forward to your Pages deploy, preserving path/query
    const upstream = `https://03c1c0d6.personal-2l6.pages.dev${url.pathname}${url.search}`;
    // Streamed pass-through (method/headers/body preserved)
    const res = await fetch(upstream, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: "manual",
    });
    return res;
  }
}