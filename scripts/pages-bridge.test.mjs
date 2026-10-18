import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../deploy/pages-bridge/public/_worker.js', import.meta.url), 'utf8');
const { default: bridge } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

for (const method of ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
  test(`${method} preserves request identity, URL, query, headers and body`, async () => {
    const hasBody = !['GET', 'HEAD'].includes(method);
    const request = new Request('https://lll-echoes.pages.dev/api/walls/test?token=a%2Bb&x=1', {
      method, headers: { authorization: 'Bearer synthetic-test', cookie: 'session=synthetic', origin: 'https://lll-echoes.pages.dev', 'content-type': 'application/octet-stream' },
      ...(hasBody ? { body: new Uint8Array([0, 1, 255, 127]) } : {}),
    });
    const response = new Response(method === 'HEAD' ? null : 'upstream', { status: 201, headers: { 'set-cookie': 'session=changed; Secure; HttpOnly; SameSite=Lax', 'x-test': 'upstream' } });
    let calls = 0;
    const actual = await bridge.fetch(request, { ECHOES_WORKER: { fetch: async received => {
      calls++;
      assert.equal(received, request);
      assert.equal(received.bodyUsed, false);
      assert.equal(received.url, request.url);
      assert.equal(received.headers.get('authorization'), 'Bearer synthetic-test');
      assert.equal(received.headers.get('cookie'), 'session=synthetic');
      assert.equal(received.headers.get('origin'), 'https://lll-echoes.pages.dev');
      if (hasBody) assert.deepEqual(new Uint8Array(await received.arrayBuffer()), new Uint8Array([0, 1, 255, 127]));
      return response;
    } } });
    assert.equal(calls, 1);
    assert.equal(actual, response);
    assert.equal(actual.headers.get('set-cookie'), response.headers.get('set-cookie'));
  });
}

test('redirect status and original-origin Location pass through unchanged', async () => {
  const response = new Response(null, { status: 307, headers: { location: 'https://lll-echoes.pages.dev/w/playground?x=1' } });
  assert.equal(await bridge.fetch(new Request('https://lll-echoes.pages.dev/'), { ECHOES_WORKER: { fetch: async () => response } }), response);
});

test('response streams and cookies are returned without buffering or reconstruction', async () => {
  let controller;
  const stream = new ReadableStream({ start(value) { controller = value; } });
  const response = new Response(stream, { headers: { 'set-cookie': 'a=1; HttpOnly' } });
  const actual = await bridge.fetch(new Request('https://lll-echoes.pages.dev/stream'), { ECHOES_WORKER: { fetch: async () => response } });
  assert.equal(actual, response);
  const reader = actual.body.getReader();
  controller.enqueue(new TextEncoder().encode('first'));
  assert.equal(new TextDecoder().decode((await reader.read()).value), 'first');
  controller.enqueue(new TextEncoder().encode('second'));
  controller.close();
  assert.equal(new TextDecoder().decode((await reader.read()).value), 'second');
  assert.equal((await reader.read()).done, true);
});

test('WebSocket upgrade response identity is retained', async () => {
  const upgrade = { status: 101, webSocket: { synthetic: true } };
  assert.equal(await bridge.fetch(new Request('https://lll-echoes.pages.dev/ws', { headers: { upgrade: 'websocket' } }), { ECHOES_WORKER: { fetch: async () => upgrade } }), upgrade);
});

test('upstream HTTP errors pass through, connection failures are generic and uncached', async () => {
  const request = new Request('https://lll-echoes.pages.dev/api/test');
  const response = new Response('safe upstream error', { status: 429 });
  assert.equal(await bridge.fetch(request, { ECHOES_WORKER: { fetch: async () => response } }), response);
  const failed = await bridge.fetch(request, { ECHOES_WORKER: { fetch: async () => { throw new Error('sensitive synthetic upstream detail'); } } });
  assert.equal(failed.status, 502);
  assert.equal(failed.headers.get('cache-control'), 'no-store');
  assert.equal(await failed.text(), 'Service temporarily unavailable.');
});

test('missing service binding fails closed without exposing environment values', async () => {
  const response = await bridge.fetch(new Request('https://lll-echoes.pages.dev/'), { SECRET: 'never-output' });
  assert.equal(response.status, 502);
  assert.equal(await response.text(), 'Service temporarily unavailable.');
});
