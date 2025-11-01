export async function onRequest(context) {
  const { request, next } = context;
  const start = Date.now();
  const response = await next();

  console.log({
    path: new URL(request.url).pathname,
    status: response.status,
    latency_ms: Date.now() - start,
    colo: request.cf?.colo,
  });

  return response;
}