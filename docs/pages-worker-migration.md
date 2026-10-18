# Echoes Pages origin migration — 2026-10-18

The existing public origin is `https://lll-echoes.pages.dev`. The new OpenNext
Worker remains private (`workers_dev = false`, `preview_urls = false`, no routes or custom domains).
A small Pages advanced-mode Worker forwards every request through the fixed
`ECHOES_WORKER` service binding to `lll-echoes`. The original Request and upstream
Response are passed through, retaining methods, body streams, query strings,
headers, cookies, redirects, and WebSocket upgrade responses. Connection failures
return an uncached generic 502 without logging request data or exceptions.
OpenNext's ASSETS and self-reference bindings remain on the application Worker.

This preserves the browser origin and existing localStorage management tokens.
No DNS change, redirect to another origin, database migration, or content writes
are needed. The old Pages deployment remains the rollback target:
`733a8444-3ac1-40d7-bd34-783bc4617337`.

The three Pages projects were inspected with authenticated GETs. Echoes production
has no configured environment variables or resource bindings. Its limits therefore
retain application defaults; `--keep-vars` is not being treated as a Pages variable
copy. The release script aborts before deployment if environment variables or
other resource bindings appear in production or preview. Such a change requires
an explicit preservation/migration update; it is never silently overwritten.
No project-configuration PATCH or environment-value dump is used.

## Release stages

Use the same independently reviewed immutable branch commit for all stages.
The workflow serializes Echoes releases and never cancels an in-progress release.

1. Upload the private application Worker using the normal deploy job:

   ```bash
   gh workflow run deploy.yml --ref <reviewed-branch> -f preflight=false -f bridge_stage=none
   ```

   This builds with the existing repository Supabase secrets, deploys the Worker
   with `--keep-vars`, and leaves the production Pages project untouched. An upload
   or permission failure stops the migration; do not retry probes or alter token
   permissions automatically. The private Worker can remain unused for diagnosis.

2. Publish only a Pages preview bridge:

   ```bash
   gh workflow run deploy.yml --ref <reviewed-branch> -f preflight=false -f bridge_stage=preview
   ```

   The driver verifies the original production deployment, empty runtime settings,
   correct Worker assets/self-reference bindings, and disabled workers.dev/version-specific preview URLs.
   Wrangler runs from an isolated temporary directory containing only the bridge
   package, avoiding discovery of the application's Worker configuration. The
   preview uses branch `codex-worker-migration-20261018`; production remains on the
   old deployment. GET checks verify original-origin redirects, `/create`, the
   database-backed playground read, missing-page behavior, and the exact reviewed
   immutable stylesheet hash. Results contain statuses, public URLs, hashes and
   deployment IDs, without response bodies or environment values.

3. After preview evidence is accepted, publish the same bridge to production:

   ```bash
   gh workflow run deploy.yml --ref <reviewed-branch> -f preflight=false -f bridge_stage=production
   ```

   The driver requires a successful same-commit preview and repeats its health
   checks before publishing to the existing Pages project's `main` branch. It
   then checks both the new deployment URL and original public origin. If health
   fails and the current production deployment belongs to this migration commit,
   it rolls back via POST to the saved original deployment and verifies the
   canonical deployment ID. A concurrent foreign deployment prevents automatic
   rollback and requires immediate investigation. No user content is edited.

If the worker upload succeeds but preview fails, leave old Pages production
serving traffic and retain the private Worker for diagnosis. Delete it only after
verifying that no Pages deployment or service relies on it. If rollback cannot be
confirmed, escalate with deployment IDs and HTTP statuses, never credential values.

## Validation limits

The bridge's request/response identity, streaming behavior, error handling and
WebSocket upgrade preservation are unit tested. Local workerd contract checks
exercise seven methods, binary bodies, query/Origin/cookie headers, streaming
payload integrity, redirects, and actual WebSocket messages. Local Pages-to-real
OpenNext checks cover the existing routes, malformed local inputs, PNG fallbacks,
and immutable CSS. Miniflare normalizes local request hosts to localhost; exact
public-origin redirect preservation is consequently a mandatory remote preview
check. Network chunks may coalesce, independently of the bridge's no-buffer
response identity. Existing production wall/note mutation flows are not tested.

Official configuration references:

- https://developers.cloudflare.com/pages/functions/bindings/#service-bindings
- https://developers.cloudflare.com/pages/functions/advanced-mode/
- https://developers.cloudflare.com/pages/functions/wrangler-configuration/#service-bindings
- https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/#pagesdev
