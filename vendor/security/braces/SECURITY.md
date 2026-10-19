# Local braces security fork

This is braces 3.0.3 with bounded parsing and AST walking for GHSA-vfj7-8cjw-p6xm, for which the reviewed advisory lists no upstream patch. UPSTREAM.json records the original npm tarball SHA512, shasum, gitHead and source URL; LICENSE and upstream README are retained. The same guarded source was first developed and tested in the Leng remediation and is reused here under a project-specific private name.

This is a source patch, not a version-only audit override. lib/limits.js defines a maximum depth of 128, 10,000 AST nodes/results and 1 MiB output. parse checks nesting before recursive work; public and direct lib compile/expand/stringify helpers validate supplied ASTs, including cycle and parent consistency checks. Expansion bounds ranges (including reversed ranges with rangeLimit:false) and Cartesian result allocation.

Run npm ci, npm run test:security, npm ls braces --all, npm audit and npm run cf:build (local-only config and dummy public env for offline validation). Tests cover normal compile/expand/stringify, 4,000-level nesting, cyclic ASTs, repeated node allocations, ranges, Cartesian products and direct helper entrypoints under a child-process time bound. Restore the registry dependency only after the advisory has a verified upstream fix and compatibility/security tests pass.
