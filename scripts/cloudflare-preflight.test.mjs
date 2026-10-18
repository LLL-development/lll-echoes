import assert from 'node:assert/strict';
import test from 'node:test';
import { runPreflight } from './cloudflare-preflight.mjs';

test('preflight performs only GETs and emits no environment values or credentials', async () => {
  const secret = 'must-never-be-printed';
  const calls = [];
  const output = await runPreflight({
    env: { CLOUDFLARE_API_TOKEN: secret, CLOUDFLARE_ACCOUNT_ID: 'account', NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: secret },
    fetcher: async (url, options = {}) => {
      url = String(url);
      calls.push({ url, options });
      const result = url.includes('/pages/projects') ? [{ name: 'lll-echoes', domains: ['lll-echoes.pages.dev'], production_branch: 'main', deployment_configs: { production: { env_vars: { ECHOES_MAX_NOTES_PER_WALL: { type: 'plain_text', value: secret } } } }, canonical_deployment: { id: 'deployment', url: 'https://deployment.lll-echoes.pages.dev', created_on: '2026-08-12' } }] : url.endsWith('/settings') ? { bindings: [{ type: 'secret_text', name: 'RUNTIME_SECRET', text: secret }] } : [];
      return { ok: true, status: 200, json: async () => ({ success: true, result }) };
    },
  });
  assert.equal(output.pages.projects[0].name, 'lll-echoes');
  assert.deepEqual(output.pages.projects[0].productionEnvNames, ['ECHOES_MAX_NOTES_PER_WALL']);
  assert.deepEqual(output.workerSettings.bindings, [{ name: 'RUNTIME_SECRET', type: 'secret_text' }]);
  assert.equal(output.supabaseHealth.httpStatus, 200);
  assert.ok(calls.every(({ options }) => !options.method || options.method === 'GET'));
  assert.ok(!JSON.stringify(output).includes(secret));
});

test('missing credentials fail before any request', async () => {
  await assert.rejects(runPreflight({ env: {}, fetcher: () => assert.fail('must not fetch') }), /Required credentials are missing/);
});

test('API failures expose only HTTP status, never response text', async () => {
  const output = await runPreflight({ env: { CLOUDFLARE_API_TOKEN: 'secret', CLOUDFLARE_ACCOUNT_ID: 'account' }, fetcher: async () => ({ ok: false, status: 403, json: async () => { throw new Error('must not parse denied body'); } }) });
  assert.equal(output.pages.httpStatus, 403);
  assert.ok(!JSON.stringify(output).includes('secret'));
});

test('Pages inventory follows pagination so later projects are not missed', async () => {
  const output = await runPreflight({ env: { CLOUDFLARE_API_TOKEN: 'secret', CLOUDFLARE_ACCOUNT_ID: 'account' }, fetcher: async url => {
    const u = new URL(url);
    const page = Number(u.searchParams.get('page') || 1);
    return { ok: true, status: 200, json: async () => ({ success: true, result: u.pathname.endsWith('/pages/projects') ? [{ name: `project-${page}` }] : [], result_info: u.pathname.endsWith('/pages/projects') ? { total_pages: 2 } : {} }) };
  } });
  assert.deepEqual(output.pages.projects.map(project => project.name), ['project-1', 'project-2']);
});
