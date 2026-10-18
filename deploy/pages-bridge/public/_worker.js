export default {
  async fetch(request, env) {
    try {
      return await env.ECHOES_WORKER.fetch(request);
    } catch {
      return new Response('Service temporarily unavailable.', {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
  },
};
