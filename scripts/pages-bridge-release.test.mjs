import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { runBridgeRelease, checkPublicHealth, ORIGINAL_DEPLOYMENT } from './pages-bridge-release.mjs';

const sha = 'a'.repeat(40);
const old = { id: ORIGINAL_DEPLOYMENT, deployment_trigger: { metadata: { commit_hash: 'old' } } };
const preview = { id: 'preview-id', url: 'https://1234abcd.lll-echoes.pages.dev', latest_stage: { status: 'success' }, deployment_trigger: { metadata: { commit_hash: sha } } };
function fixture(options = {}) {
  const calls = [];
  let deployed = false;
  let rolledBack = false;
  const project = () => ({ production_branch: 'main', canonical_deployment: deployed && !rolledBack && options.stage === 'production' ? { id: 'new-id', deployment_trigger: { metadata: { commit_hash: sha } } } : (options.canonical ?? old), deployment_configs: { production: options.production ?? { env_vars: {}, service_bindings: {} }, preview: { env_vars: {}, service_bindings: {} } } });
  return { calls, dependencies: {
    sha,
    read: async path => { calls.push(['GET', path]); if (path.endsWith('/settings')) return { bindings: [{name:'ASSETS',type:'assets'}, {name:'WORKER_SELF_REFERENCE',type:'service',service:'lll-echoes'}] }; if (path.endsWith('/subdomain')) return { enabled: false, previews_enabled: false }; if (path.includes('/deployments?')) return options.previews ?? [preview]; return project(); },
    deploy: async stage => { calls.push(['DEPLOY', stage]); deployed = true; return preview.url; },
    health: async url => { calls.push(['HEALTH', url]); if (options.failHealth && url === 'https://lll-echoes.pages.dev') throw new Error('sensitive request detail'); return [{ status: 200 }]; },
    rollback: async id => { calls.push(['ROLLBACK', id]); if (!options.rollbackFails) rolledBack = true; },
  } };
}

test('preview deploy leaves production unchanged and selects metadata only', async () => {
  const f = fixture();const result = await runBridgeRelease('preview', f.dependencies);
  assert.equal(result.previousProductionDeployment, ORIGINAL_DEPLOYMENT);
  assert.equal(result.previewURL, preview.url);
  assert.deepEqual(f.calls.filter(c => c[0] === 'DEPLOY'), [['DEPLOY','preview']]);
  assert.equal(f.calls.some(c => c[0] === 'ROLLBACK'), false);
});

test('production requires successful same-commit preview before deployment', async () => {
  const f = fixture({ stage: 'production', previews: [] });
  await assert.rejects(runBridgeRelease('production', f.dependencies), /successful same-commit preview/);
  assert.equal(f.calls.some(c => c[0] === 'DEPLOY'), false);
});

test('unexpected production deployment stops before any write', async () => {
  const f = fixture({ canonical: { id: 'someone-elses-deploy' } });
  await assert.rejects(runBridgeRelease('preview', f.dependencies), /Production baseline changed/);
  assert.equal(f.calls.some(c => c[0] === 'DEPLOY'), false);
});

for (const production of [{ env_vars: { ECHOES_MAX_NOTES_PER_WALL: { type:'secret_text',value:'never-print' } } }, { kv_namespaces: { EXISTING: { namespace_id:'id' } } }, { service_bindings: { OTHER: { service:'other' } } }]) {
  test('existing runtime settings prevent accidental replacement', async () => {
    const f = fixture({ production });
    await assert.rejects(runBridgeRelease('preview', f.dependencies), /Existing runtime configuration requires preservation/);
    assert.equal(f.calls.some(c => c[0] === 'DEPLOY'), false);
  });
}

test('failed production health rolls back only this migration deployment', async () => {
  const f = fixture({ stage:'production', failHealth:true });
  await assert.rejects(runBridgeRelease('production', f.dependencies), /Production health failed; previous Pages deployment restored/);
  assert.deepEqual(f.calls.filter(c => c[0] === 'ROLLBACK'), [['ROLLBACK',ORIGINAL_DEPLOYMENT]]);
});

test('production validates preview again before publishing and checks public origin', async () => {
  const f = fixture({ stage:'production' });const result = await runBridgeRelease('production',f.dependencies);
  assert.equal(result.productionDeployment,'new-id');
  assert.deepEqual(f.calls.filter(c => c[0] === 'HEALTH').map(c => c[1]), [preview.url, preview.url, 'https://lll-echoes.pages.dev']);
});

test('public Worker or missing self-reference binding stops before write', async () => {
  const f=fixture();f.dependencies.read=async path=>path.endsWith('/subdomain')?{enabled:true}:path.endsWith('/settings')?{bindings:[]}:({production_branch:'main',canonical_deployment:old,deployment_configs:{}});
  await assert.rejects(runBridgeRelease('preview',f.dependencies), /Worker must be private|Worker bindings are incomplete/);
  assert.equal(f.calls.some(c=>c[0]==='DEPLOY'),false);
});


test('public health checks use only GETs and require original-origin redirects and reviewed CSS', async () => {
  const origin = 'https://1234abcd.lll-echoes.pages.dev';
  const css = 'body{color:blue}';
  const hash = createHash('sha256').update(css).digest('hex');
  const calls = [];
  const transport = async (url, options) => {
    calls.push(options.method);
    const route = new URL(url).pathname;
    if (route === '/create') return new Response('<link href="/_next/static/css/reviewed.css">');
    if (route.endsWith('.css')) return new Response(css, {headers:{'cache-control':'public,max-age=31536000,immutable'}});
    if (['/', '/playground', '/w/synthetic-migration/edit'].includes(route)) return new Response(null,{status:307,headers:{location:origin+'/w/playground'}});
    if (route === '/w/playground') return new Response('synthetic wall HTML is not returned by health results');
    return new Response(null,{status:404});
  };
  const result = await checkPublicHealth(origin, transport, hash);
  assert.ok(calls.every(method => method === 'GET'));
  assert.ok(!JSON.stringify(result).includes('synthetic wall HTML'));
  assert.equal(result.at(-1).sha256, hash);
  const badOrigin = (url, options) => ['/', '/playground'].includes(new URL(url).pathname) ? new Response(null,{status:307,headers:{location:'https://wrong.example/w/playground'}}) : transport(url,options);
  await assert.rejects(checkPublicHealth(origin,badOrigin,hash), /Original-origin redirect/);
});


test('rollback must be confirmed before reporting restoration', async () => {
  const f = fixture({ stage:'production', failHealth:true, rollbackFails:true });
  await assert.rejects(runBridgeRelease('production',f.dependencies), /Rollback could not be confirmed/);
});

test('version-specific Worker preview URLs must also be disabled', async () => {
  const f = fixture();
  const read = f.dependencies.read;
  f.dependencies.read = path => path.endsWith('/subdomain') ? { enabled:false, previews_enabled:true } : read(path);
  await assert.rejects(runBridgeRelease('preview',f.dependencies), /Worker must be private/);
  assert.equal(f.calls.some(call => call[0] === 'DEPLOY'),false);
});
