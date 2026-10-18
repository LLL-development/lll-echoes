import { pathToFileURL } from 'node:url';

// Deliberately select public metadata and names; Cloudflare responses can contain
// plaintext environment values. Never print complete responses or request errors.
export async function runPreflight({ env = process.env, fetcher = fetch } = {}) {
  const token = env.CLOUDFLARE_API_TOKEN;
  const account = env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !account) throw new Error('Required credentials are missing');
  const base = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}`;
  async function read(path, select) {
    try {
      const paginated = path === '/pages/projects';
      const all = [];
      let totalPages = 1;
      for (let page = 1; page <= totalPages; page++) {
        const url = base + path + (paginated && page > 1 ? `?page=${page}` : '');
        const response = await fetcher(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(25000) });
        if (!response.ok) {
          let errorCodes = [];
          try {
            const errorBody = await response.json();
            errorCodes = (errorBody.errors ?? []).map(error => error.code).filter(Number.isSafeInteger);
          } catch {
            // Non-JSON failures still retain their HTTP status; never print bodies.
          }
          return { httpStatus: response.status, errorCodes };
        }
        const body = await response.json();
        if (!body.success) return { httpStatus: response.status, apiSuccess: false };
        if (!paginated) return { httpStatus: response.status, ...select(body.result) };
        all.push(...body.result);
        totalPages = body.result_info?.total_pages ?? 1;
        if (!Number.isInteger(totalPages) || totalPages < 1 || totalPages > 100) {
          return { httpStatus: response.status, paginationIncomplete: true };
        }
      }
      return { httpStatus: 200, ...select(all) };
    } catch {
      return { requestFailed: true };
    }
  }
  const targets = ['lll-echoes', 'lll-simple-qr', 'lll-humanize'];
  const pages = await read('/pages/projects', projects => ({ projects: projects.filter(project => targets.includes(project.name)).map(project => ({
    name: project.name,
    domains: project.domains ?? [],
    productionBranch: project.production_branch,
    productionEnvNames: Object.keys(project.deployment_configs?.production?.env_vars ?? {}).sort(),
    latestProductionDeployment: project.canonical_deployment ? {
      id: project.canonical_deployment.id,
      url: project.canonical_deployment.url,
      createdOn: project.canonical_deployment.created_on,
      commit: project.canonical_deployment.deployment_trigger?.metadata?.commit_hash,
    } : null,
  })) }));
  const projectDetails = {};
  for (const name of targets) {
    projectDetails[name] = await read(`/pages/projects/${name}`, project => {
      const production = project.deployment_configs?.production ?? {};
      return {
        name: project.name,
        domains: project.domains ?? [],
        productionBranch: project.production_branch,
        productionEnv: Object.entries(production.env_vars ?? {}).map(([name, variable]) => ({ name, type: variable.type })).sort((a, b) => a.name.localeCompare(b.name)),
        compatibilityDate: production.compatibility_date,
        compatibilityFlags: production.compatibility_flags ?? [],
        serviceBindings: Object.entries(production.service_bindings ?? {}).map(([name, binding]) => ({ name, service: binding.service, environment: binding.environment })),
      };
    });
  }
  const workers = await read('/workers/scripts', scripts => ({ names: scripts.map(script => script.id).sort() }));
  const workerSettings = await read('/workers/scripts/lll-echoes/settings', settings => ({ bindings: (settings.bindings ?? []).map(binding => ({ name: binding.name, type: binding.type })) }));
  const workerDomains = await read('/workers/domains', domains => ({ domains: domains.map(domain => ({ hostname: domain.hostname, service: domain.service, environment: domain.environment })) }));
  let supabaseHealth = { configured: false };
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const origin = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
      if (origin.protocol !== 'https:' || !origin.hostname.endsWith('.supabase.co') || origin.username || origin.password) {
        supabaseHealth = { configured: true, supportedPublicOrigin: false };
      } else {
        const response = await fetcher(new URL('/auth/v1/health', origin), { method: 'GET', headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY }, signal: AbortSignal.timeout(25000) });
        supabaseHealth = { configured: true, httpStatus: response.status };
      }
    } catch {
      supabaseHealth = { configured: true, requestFailed: true };
    }
  }
  return { pages, projectDetails, workers, workerSettings, workerDomains, supabaseHealth };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(await runPreflight(), null, 2));
  } catch {
    console.error('Preflight failed: required credentials are missing.');
    process.exitCode = 1;
  }
}
