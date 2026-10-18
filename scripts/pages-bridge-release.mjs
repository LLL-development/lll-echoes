import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ORIGINAL_DEPLOYMENT = '733a8444-3ac1-40d7-bd34-783bc4617337';
const PROJECT = 'lll-echoes';
const PREVIEW_BRANCH = 'codex-worker-migration-20261018';
const CSS_SHA256 = '8aa8d07293dc34d57d99b36c6f28898c613a543496160979929fdd3e2b93db1c';
const commitOf = deployment => deployment?.deployment_trigger?.metadata?.commit_hash;
const safePreviewURL = value => typeof value === 'string' && /^https:\/\/[a-f0-9]{8,32}\.lll-echoes\.pages\.dev\/?$/.test(value);

function requireEmptyRuntime(config = {}) {
  const resourceFields = ['env_vars', 'kv_namespaces', 'durable_object_namespaces', 'd1_databases', 'r2_buckets', 'vectorize_bindings', 'ai_bindings', 'queue_producers', 'analytics_engine_datasets', 'hyperdrive_bindings', 'mtls_certificates', 'browser', 'images'];
  const nonempty = value => value && (typeof value !== 'object' || Object.keys(value).length > 0);
  const services = config.service_bindings ?? {};
  if (resourceFields.some(field => nonempty(config[field])) || Object.entries(services).some(([name, binding]) => name !== 'ECHOES_WORKER' || binding.service !== PROJECT)) {
    throw new Error('Existing runtime configuration requires preservation; migration stopped before deployment.');
  }
}

export async function runBridgeRelease(stage, { sha, read, deploy, health, rollback }) {
  if (!['preview', 'production'].includes(stage) || !/^[a-f0-9]{40}$/.test(sha ?? '')) throw new Error('Invalid migration stage or immutable commit.');
  const projectPath = `/pages/projects/${PROJECT}`;
  const project = await read(projectPath);
  if (project.production_branch !== 'main' || project.canonical_deployment?.id !== ORIGINAL_DEPLOYMENT) throw new Error('Production baseline changed; migration stopped before deployment.');
  requireEmptyRuntime(project.deployment_configs?.production);
  requireEmptyRuntime(project.deployment_configs?.preview);
  const settings = await read(`/workers/scripts/${PROJECT}/settings`);
  const bindings = settings.bindings ?? [];
  if (!bindings.some(binding => binding.name === 'ASSETS' && binding.type === 'assets') || !bindings.some(binding => binding.name === 'WORKER_SELF_REFERENCE' && binding.type === 'service' && binding.service === PROJECT)) throw new Error('Worker bindings are incomplete; Pages production remains unchanged.');
  const exposure = await read(`/workers/scripts/${PROJECT}/subdomain`);
  if (exposure.enabled !== false || exposure.previews_enabled !== false) throw new Error('Worker must be private before Pages migration.');
  if (stage === 'production') {
    const previews = await read(`${projectPath}/deployments?env=preview`);
    const preview = previews.find(deployment => commitOf(deployment) === sha && deployment.latest_stage?.status === 'success' && safePreviewURL(deployment.url));
    if (!preview) throw new Error('A successful same-commit preview is required before production.');
    await health(preview.url);
  }
  try {
    const deployedURL = await deploy(stage);
    if (!safePreviewURL(deployedURL)) throw new Error('Deployment URL did not match the fixed Pages project.');
    const previewChecks = await health(deployedURL);
    if (stage === 'preview') {
      if ((await read(projectPath)).canonical_deployment?.id !== ORIGINAL_DEPLOYMENT) throw new Error('Production changed during preview; inspect deployment state.');
      return { stage, commit: sha, previousProductionDeployment: ORIGINAL_DEPLOYMENT, previewURL: deployedURL, checks: previewChecks };
    }
    const checks = await health(`https://${PROJECT}.pages.dev`);
    const current = (await read(projectPath)).canonical_deployment;
    if (commitOf(current) !== sha) throw new Error('Unexpected production commit after publication.');
    return { stage, commit: sha, previousProductionDeployment: ORIGINAL_DEPLOYMENT, productionDeployment: current.id, productionURL: `https://${PROJECT}.pages.dev`, checks };
  } catch {
    if (stage === 'preview') throw new Error('Preview deployment or health failed; production was not intentionally changed.');
    const current = (await read(projectPath)).canonical_deployment;
    if (current?.id === ORIGINAL_DEPLOYMENT) throw new Error('Release failed before production traffic changed.');
    if (commitOf(current) !== sha) throw new Error('Production changed concurrently; automatic rollback stopped for manual inspection.');
    await rollback(ORIGINAL_DEPLOYMENT);
    if ((await read(projectPath)).canonical_deployment?.id !== ORIGINAL_DEPLOYMENT) throw new Error('Rollback could not be confirmed; inspect Pages production immediately.');
    throw new Error('Production health failed; previous Pages deployment restored.');
  }
}

export async function checkPublicHealth(origin, fetcher = fetch, expectedCSS = CSS_SHA256) {
  const checks = [];
  let html;
  for (const [route, expected] of [['/create', 200], ['/', 307], ['/playground', 307], ['/w/synthetic-migration/edit', 307], ['/missing-migration-page', 404], ['/w/playground', 200]]) {
    const response = await fetcher(new URL(route, origin), { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(30000) });
    if (response.status !== expected) throw new Error('Public route health failed.');
    if (expected === 307) {
      const location = new URL(response.headers.get('location'), origin);
      if (location.origin !== new URL(origin).origin || location.pathname !== '/w/playground') throw new Error('Original-origin redirect health failed.');
    }
    if (route === '/create') html = await response.text();
    else await response.body?.cancel();
    checks.push({ route, status: response.status });
  }
  const assetPath = html.match(/href="(\/_next\/static\/css\/[^"?]+\.css)/)?.[1];
  if (!assetPath) throw new Error('Reviewed stylesheet is missing.');
  const asset = await fetcher(new URL(assetPath, origin), { method: 'GET', signal: AbortSignal.timeout(30000) });
  const hash = createHash('sha256').update(Buffer.from(await asset.arrayBuffer())).digest('hex');
  if (asset.status !== 200 || hash !== expectedCSS || !asset.headers.get('cache-control')?.includes('immutable')) throw new Error('Reviewed stylesheet health failed.');
  checks.push({ route: assetPath, status: asset.status, sha256: hash });
  return checks;
}

async function main(stage) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const sha = process.env.GITHUB_SHA;
  if (!token || !account) throw new Error('Required Cloudflare credentials are missing.');
  const request = async (route, method = 'GET') => {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}${route}`, { method, headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
    let body;
    try { body = await response.json(); } catch { throw new Error(`Cloudflare ${method} failed: HTTP ${response.status}.`); }
    if (!response.ok || !body.success) {
      const codes = (body.errors ?? []).map(error => error.code).filter(Number.isSafeInteger);
      throw new Error(`Cloudflare ${method} failed: HTTP ${response.status}; codes ${codes.join(',')}.`);
    }
    return body.result;
  };
  const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const cli = path.join(repo, 'node_modules/wrangler/bin/wrangler.js');
  const result = await runBridgeRelease(stage, {
    sha, read: request, health: checkPublicHealth,
    rollback: id => request(`/pages/projects/${PROJECT}/deployments/${id}/rollback`, 'POST'),
    deploy: async phase => {
      const directory = await mkdtemp(path.join(tmpdir(), 'echoes-pages-bridge-'));
      try {
        await cp(path.join(repo, 'deploy/pages-bridge'), directory, { recursive: true });
        const args = [cli, 'pages', 'deploy', 'public', '--project-name', PROJECT, '--branch', phase === 'production' ? 'main' : PREVIEW_BRANCH, '--commit-hash', sha, '--commit-dirty=false'];
        let stdout;
        try { ({ stdout } = await promisify(execFile)(process.execPath, args, { cwd: directory, env: process.env, timeout: 240000, maxBuffer: 1024 * 1024 })); }
        catch { throw new Error('Pages deployment command failed; no CLI response body printed.'); }
        const matches = stdout.match(/https:\/\/[a-f0-9]{8,32}\.lll-echoes\.pages\.dev/g);
        if (!matches?.length) throw new Error('No deployment URL was returned.');
        return matches.at(-1);
      } finally { await rm(directory, { recursive: true, force: true }); }
    },
  });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
}
