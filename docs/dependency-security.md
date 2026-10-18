# Dependency security maintenance

Validated 2026-10-18. The Cloudflare Worker migration uses Next 15.5.28 and
OpenNext 1.20.12. Three narrowly scoped dependency overrides replace affected
packages with published fixes; they do not suppress audit findings:

| Dependency source | Upstream constraint | Installed fix | Reason |
| --- | --- | --- | --- |
| `next` | PostCSS `8.4.31` exactly | PostCSS `8.5.23` | Same major; fixes source-map disclosure and CSS output issues, including GHSA-fxqj-rqcc-2cmp. |
| `@node-minify/core` | glob `10.3.3` exactly | glob `10.5.0` | Same major; fixes CLI command injection GHSA-5j98-mcp5-4vw2. |
| `tailwindcss` and its `postcss-nested` dependency | selector parser `^6` | postcss-selector-parser `7.1.6` | Fixes selector CPU exhaustion GHSA-rj75-hqrm-r3gf. This is a parser major replacement, verified against this application's CSS. |

The full application stylesheet, scanned application class names, nesting,
`@apply`, responsive/state variants, arbitrary variants, and arbitrary colors
produced byte-identical CSS before and after the parser replacement (32,289
bytes). Clean installation, dependency-tree validation, TypeScript, Next/OpenNext
build, and local Worker smoke checks must remain part of changes to these pins.
Remove an override when the corresponding upstream dependency accepts a patched
version, and re-run the same checks. A lock file can retain stale nested versions
after an override edit; always inspect `npm ls` and `npm audit`, rather than
assuming the manifest proves the replacement.

Remaining development-tool advisories originate in `braces <=3.0.3`
(GHSA-vfj7-8cjw-p6xm), for which the advisory lists no patched version. Tailwind's
file watcher/scanner and the Next ESLint plugin depend on it through
chokidar/fast-glob/micromatch. Their inputs are repository-owned source paths and
patterns. Application routes do not compile user-supplied glob patterns or run
the developer watcher. Keep development/watch services private. This limits the
application's exposure; it does not close or dismiss the upstream advisory.
Upgrading Next and Tailwind majors alone would still leave the current Next
ESLint plugin's fast-glob/braces chain. Do not replace it with an unmaintained
fork solely to make the audit counter disappear.

Sources checked on 2026-10-18:

- https://github.com/advisories/GHSA-fxqj-rqcc-2cmp
- https://github.com/advisories/GHSA-5j98-mcp5-4vw2
- https://github.com/advisories/GHSA-rj75-hqrm-r3gf
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://registry.npmjs.org/next/15.5.28
- https://registry.npmjs.org/@node-minify%2fcore/9.0.2
- https://registry.npmjs.org/tailwindcss/3.4.19

# Read-only production preflight

The existing Deploy workflow supports `workflow_dispatch` with `preflight=true`
(the manual default). It runs only GET requests using existing repository
secrets. It prints Pages project names/domains, production deployment metadata,
environment **names**, Worker names, Worker binding **names/types**, custom domain
metadata, and the Supabase authentication health HTTP status. Full API responses,
credentials, environment values, and error response bodies are never printed or
saved as artifacts. The unit tests verify this selection and the GET-only policy.

Run against a reviewed branch before release:

```bash
gh workflow run deploy.yml --ref <reviewed-branch> -f preflight=true
```

A successful workflow means the checks ran: inspect individual HTTP statuses for
missing permissions or resources. It does not prove Worker write permissions,
full database/storage access, application mutations, or domain migration. To
perform an explicitly intended manual Worker deployment, pass
`-f preflight=false`. Pushes to main retain the usual deployment behavior.

Worker deployment does not move the legacy `lll-echoes.pages.dev` hostname.
Before changing custom-domain traffic, preserve required runtime limits from
Pages, confirm the intended Supabase project is embedded at build time, check
the Worker on its own hostname, and retain the existing Pages deployment for
rollback. No content writes are required for preflight.
