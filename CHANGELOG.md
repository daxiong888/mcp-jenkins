# Changelog

All notable changes to this project are documented here.

---

## [3.0.0-rc.1] — 2026-08-27

Independent release candidate under `@daxiong888/mcp-jenkins`, forked from
[`kud/mcp-jenkins`](https://github.com/kud/mcp-jenkins) v2.2.0.

### Breaking changes

- Multi-instance calls that target a Jenkins server now require an explicit `instance`; `jenkins_list_instances` remains an unscoped inventory call. Configuration value counts must match, so credentials never fall back to the first Jenkins instance.
- Console log reads are bounded and cursor-based; the deprecated `fullLog` alias contains only the returned chunk.
- Jenkins handler failures are returned as MCP tool results with `isError: true` instead of protocol-level JSON-RPC errors.

### Reliability and security

- All HTTP methods reject non-2xx responses with sanitized status-only errors and dedicated authentication/permission failures.
- Write operations propagate Jenkins failures, validate job paths, and expose queue IDs for triggered and replayed builds.
- Safe restart handles Jenkins' scheduling redirect without following it into the controller shutdown window, and clears the cached crumb/session state after accepting the restart.
- Write requests refresh the crumb/session and retry exactly once after a 403; a genuine permission failure remains a 403 on the second attempt.
- `jenkins_list_nodes` returns the controller's URL-usable `(built-in)` name alongside its display name; node reads and toggles also accept the `master`, `(master)`, `built-in`, `(built-in)`, and `Built-In Node` aliases.
- Tool filtering is enforced for both discovery and calls, input schemas are validated at runtime, and logs redact URLs, credentials, authorization headers, and response bodies.
- Recursive job traversal, recent build queries, artifact downloads, and console logs are bounded.
- Console log cursors now follow the exact plain-text output bytes, preventing dropped or corrupted text across UTF-8 and Jenkins line-ending boundaries.

### Validation status — 2026-08-27

- `npm test` (23 files, 244 tests), `npm run typecheck`, and `npm run build` passed locally on macOS arm64 with Node.js v24.11.1.
- `npm run test:integration:docker:matrix` passed in two independent local runs. Each Jenkins 2.411, 2.477, and 2.568.2 leg used two disposable controllers, asserted the reported versions, and exercised explicit instance/credential isolation plus the covered write paths.
- The published npm Registry `next` tarball matched SHA-1 `e593281fcc00ce4783f25fde7c60d8797d1473a3`; a clean install completed an MCP stdio `initialize` handshake as `3.0.0-rc.1`, listed 38 tools, and kept the test URL and credentials out of stderr.
- [GitHub Actions run 33042439411](https://github.com/daxiong888/mcp-jenkins/actions/runs/33042439411) passed `npm ci`, typecheck, build, and all tests on Node.js 20, 22, and 24.
- npm assigned both `next` and the required `latest` dist-tag to this first published version. A future stable `3.0.0` release will move `latest`; `next` remains the release-candidate channel.
- Replay has unit/mock coverage but was excluded from Docker because the stock controller images lack the required Pipeline/Workflow plugins. No write request was sent to a real Jenkins instance, and the Docker controllers did not reproduce real plugin, security, SSO, or reverse-proxy configuration.

---

## [2.2.0] — 2026-08-11

### ✨ Features

- Nested Jenkins folder support — `jenkins_list_jobs` and `jenkins_search_jobs` can now recurse into sub-folders. Originally proposed by @farhanali67 in [#15](https://github.com/kud/mcp-jenkins/pull/15), landed via [#16](https://github.com/kud/mcp-jenkins/pull/16) ([#64d2007](https://github.com/kud/mcp-jenkins/commit/64d2007), [#f7e63a4](https://github.com/kud/mcp-jenkins/commit/f7e63a4)). Recursion is opt-in via `recursive: true` and defaults to `false` — traversal costs one sequential HTTP request per folder, so a blanket default could take minutes on a large instance; released `main` never recursed, so no existing caller's behaviour changes. Multibranch projects are detected but deliberately not descended into, since one child job per branch would make traversal cost scale with branch count.
- MCP tool annotations — all 38 tools now advertise `readOnlyHint`, `destructiveHint`, and `idempotentHint` ([#e41ee66](https://github.com/kud/mcp-jenkins/commit/e41ee66)), so clients like Claude can skip confirmation prompts on read-only calls while still gating anything that writes or destroys state.

### 🐛 Bug Fixes

- Malformed job names now return `Errors.invalidInput` (HTTP 400) instead of an opaque 500, so bad input is distinguishable from a server fault ([#f7e63a4](https://github.com/kud/mcp-jenkins/commit/f7e63a4)).

### 📝 Documentation

- Docs moved off GitHub Pages to [kud.io/projects](https://kud.io/projects) — README slimmed to a front-page hero, reference docs split into multi-page kud-site format, and the old Pages site/workflow removed ([#3ff03e5](https://github.com/kud/mcp-jenkins/commit/3ff03e5), [#34fa926](https://github.com/kud/mcp-jenkins/commit/34fa926), [#cb01c8d](https://github.com/kud/mcp-jenkins/commit/cb01c8d), [#2a49811](https://github.com/kud/mcp-jenkins/commit/2a49811), [#6c08078](https://github.com/kud/mcp-jenkins/commit/6c08078), [#67f2ccd](https://github.com/kud/mcp-jenkins/commit/67f2ccd)).

<details>
<summary>🔧 Internal changes (5 commits)</summary>

- refactor(tools): extract tool manifest for testability, add annotation tests + CI ([#60d1ef8](https://github.com/kud/mcp-jenkins/commit/60d1ef8))
- fix(release): fix npm OIDC workflow pattern ([#c441b6e](https://github.com/kud/mcp-jenkins/commit/c441b6e))
- docs(claude): add distribution and API surface conventions ([#8b4090c](https://github.com/kud/mcp-jenkins/commit/8b4090c))
- chore: remove obsolete GitHub Pages workflow ([#54daad1](https://github.com/kud/mcp-jenkins/commit/54daad1))
- chore: remove old GitHub Pages site ([#ef2cb23](https://github.com/kud/mcp-jenkins/commit/ef2cb23))

</details>

---

## [2.0.0] — 2026-04-18

### ✨ Features

- Add `jenkins_get_job_parameters` tool to query job parameter definitions ([#5aaad99](https://github.com/kud/mcp-jenkins/commit/5aaad99))

### 🐛 Bug Fixes

- Use `console.error` to prevent stdout pollution in MCP transport ([#d1c04d5](https://github.com/kud/mcp-jenkins/commit/d1c04d5))

### 📝 Documentation

- Add initial documentation site with GitHub Pages deployment ([#e3f80e9](https://github.com/kud/mcp-jenkins/commit/e3f80e9))
- Promote env vars as recommended config approach ([#8bb6a10](https://github.com/kud/mcp-jenkins/commit/8bb6a10))
- Update and simplify hero command ([#c64d54f](https://github.com/kud/mcp-jenkins/commit/c64d54f), [#d9b7adb](https://github.com/kud/mcp-jenkins/commit/d9b7adb))

### 📦 Other

- Rename `MCP_JENKINS_TOOLS` to `MCP_JENKINS_ALLOW_TOOLS` ⚠️ breaking ([#03ec72f](https://github.com/kud/mcp-jenkins/commit/03ec72f))

<details>
<summary>🔧 Internal changes (2 commits)</summary>

- test(logger): add 6 unit tests with stderr regression guard ([#e2cdd48](https://github.com/kud/mcp-jenkins/commit/e2cdd48))
- fix(build): add node types to tsconfig and upgrade dependencies ([#4017180](https://github.com/kud/mcp-jenkins/commit/4017180))

</details>
