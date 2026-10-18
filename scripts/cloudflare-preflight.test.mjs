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
    return { ok: true, status: 200, json: async () => ({ success: true, result: u.pathname.endsWith('/pages/projects') ? [{ name: page === 1 ? 'lll-simple-qr' : 'lll-humanize' }] : [], result_info: u.pathname.endsWith('/pages/projects') ? { total_pages: 2 } : {} }) };
  } });
  assert.deepEqual(output.pages.projects.map(project => project.name), ['lll-simple-qr', 'lll-humanize']);
});

test('Pages uses default page size and never sends per_page', async () => {
  const pagesURLs = [];
  await runPreflight({ env: { CLOUDFLARE_API_TOKEN: 'secret', CLOUDFLARE_ACCOUNT_ID: 'account' }, fetcher: async url => {
    const u = new URL(url);
    if (u.pathname.endsWith('/pages/projects')) pagesURLs.push(u);
    return { ok: true, status: 200, json: async () => ({ success: true, result: [], result_info: u.pathname.endsWith('/pages/projects') ? { total_pages: 2 } : {} }) };
  } });
  assert.equal(pagesURLs.length, 2);
  assert.ok(pagesURLs.every(url => !url.searchParams.has('per_page')));
  assert.equal(pagesURLs[1].searchParams.get('page'), '2');
});

test('HTTP errors select numeric codes without exposing messages or body fields', async () => {
  const marker = 'do-not-print-response';
  const output = await runPreflight({ env: { CLOUDFLARE_API_TOKEN: 'secret', CLOUDFLARE_ACCOUNT_ID: 'account' }, fetcher: async () => ({ ok: false, status: 400, json: async () => ({ errors: [{ code: 1001, message: marker }, { code: marker }], metadata: marker }) }) });
  assert.deepEqual(output.pages.errorCodes, [1001]);
  assert.ok(!JSON.stringify(output).includes(marker));
});

test('only target projects are inventoried and detail settings expose names/types only', async () => {
  const marker = 'never-print-detail-value';
  const output = await runPreflight({ env: { CLOUDFLARE_API_TOKEN: 'secret', CLOUDFLARE_ACCOUNT_ID: 'account' }, fetcher: async url => {
    const path = new URL(url).pathname;
    let result = [];
    if (path.endsWith('/pages/projects')) result = [{ name: 'unrelated-project', domains: ['unrelated.pages.dev'], deployment_configs: { production: { env_vars: { UNRELATED_SECRET: { value: marker } } } } }, { name: 'lll-humanize', domains: ['lll-humanize.pages.dev'] }];
    if (path.endsWith('/pages/projects/lll-humanize')) result = { name: 'lll-humanize', domains: ['lll-humanize.pages.dev'], deployment_configs: { production: { env_vars: { ANTHROPIC_API_KEY: { type: 'secret_text', value: marker } }, compatibility_date: '2026-08-11', compatibility_flags: ['nodejs_compat'], service_bindings: { HELPER: { service: 'helper-worker', environment: 'production' } } } } };
    return { ok: true, status: 200, json: async () => ({ success: true, result }) };
  } });
  assert.deepEqual(output.pages.projects.map(project => project.name), ['lll-humanize']);
  assert.deepEqual(output.projectDetails['lll-humanize'].productionEnv, [{ name: 'ANTHROPIC_API_KEY', type: 'secret_text' }]);
  assert.deepEqual(output.projectDetails['lll-humanize'].serviceBindings, [{ name: 'HELPER', service: 'helper-worker', environment: 'production' }]);
  assert.ok(!JSON.stringify(output).includes(marker));
  assert.ok(!JSON.stringify(output).includes('UNRELATED_SECRET'));
});
