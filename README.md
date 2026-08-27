<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white)
![npm](https://img.shields.io/npm/v/@daxiong888/mcp-jenkins?style=flat-square&color=CB3837)
![MIT](https://img.shields.io/badge/licence-MIT-22C55E?style=flat-square)

**Jenkins MCP server with reliable writes and safe multi-instance routing**

<a href="https://github.com/daxiong888/mcp-jenkins">Repository</a> · <a href="https://github.com/daxiong888/mcp-jenkins/tree/main/docs">Documentation</a>

</div>

> This is an independent fork of [kud/mcp-jenkins](https://github.com/kud/mcp-jenkins). The original project and copyright remain attributed under the MIT license. This fork uses a separate npm scope and is not an upstream release.

## Features

- **38 tools** — covers ~95% of the Jenkins API: jobs, builds, nodes, views, queue, plugins, and system operations
- **Bearer token auth** — supports both classic API token and modern bearer token authentication
- **Multiple instances** — connect to several Jenkins servers simultaneously using comma-separated env vars
- **Pipeline awareness** — retrieve stage-by-stage pipeline status, console logs, test results, and build artefacts
- **Node management** — list agents, toggle nodes online/offline, and inspect system info without leaving your AI client
- **Zero-install usage** — run the release candidate directly via `npx --yes @daxiong888/mcp-jenkins@next` with no local setup required

## Install

> Release candidate status: `@daxiong888/mcp-jenkins@3.0.0-rc.1` is published. Use the `next` tag for release-candidate evaluation and pin the exact version for any reviewed deployment.

```sh
npm install -g @daxiong888/mcp-jenkins@next
```

Or use without installing via `npx` (see Usage below). Because this is the
first published version, npm also assigned `latest` to `3.0.0-rc.1`; the npm
registry requires a `latest` dist-tag, so it cannot be removed. This is
currently the package's only published version; a future stable `3.0.0` release
will move `latest`, while `next` remains the release-candidate channel.

## Usage

Add the server to your MCP client config. The recommended approach uses environment variables:

```json
{
  "mcpServers": {
    "jenkins": {
      "command": "npx",
      "args": ["--yes", "@daxiong888/mcp-jenkins@next"],
      "env": {
        "MCP_JENKINS_URL": "https://pipeline.yourcompany.com",
        "MCP_JENKINS_USER": "your_username",
        "MCP_JENKINS_API_TOKEN": "your_api_token"
      }
    }
  }
}
```

For bearer token authentication, replace the env block with:

```json
"env": {
  "MCP_JENKINS_URL": "https://pipeline.yourcompany.com",
  "MCP_JENKINS_BEARER_TOKEN": "your_bearer_token"
}
```

The client config file itself contains your credentials: restrict its permissions, never commit it to version control, and prefer a secret manager or your client's secure credential mechanism when one is available.

### Tools

| Category                | Tools                                                                                                                                                                                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Job operations**      | `jenkins_list_jobs`, `jenkins_search_jobs`, `jenkins_get_job_status`, `jenkins_get_job_parameters`, `jenkins_enable_job`, `jenkins_disable_job`, `jenkins_delete_job`, `jenkins_get_job_config`, `jenkins_create_job`, `jenkins_update_job_config`, `jenkins_rename_job`, `jenkins_copy_job` |
| **Build operations**    | `jenkins_get_build_status`, `jenkins_get_recent_builds`, `jenkins_trigger_build`, `jenkins_stop_build`, `jenkins_delete_build`, `jenkins_replay_build`, `jenkins_get_console_log`, `jenkins_get_build_changes`, `jenkins_get_pipeline_stages`                                                |
| **Testing & artefacts** | `jenkins_get_test_results`, `jenkins_list_artifacts`, `jenkins_get_artifact`                                                                                                                                                                                                                 |
| **Queue management**    | `jenkins_get_queue`, `jenkins_cancel_queue`                                                                                                                                                                                                                                                  |
| **System & nodes**      | `jenkins_list_nodes`, `jenkins_get_node`, `jenkins_toggle_node_offline`, `jenkins_get_system_info`, `jenkins_get_version`, `jenkins_get_plugins`, `jenkins_quiet_down`, `jenkins_cancel_quiet_down`                                                                                          |
| **Views**               | `jenkins_list_views`, `jenkins_get_view`                                                                                                                                                                                                                                                     |
| **Instances & admin**   | `jenkins_list_instances`, `jenkins_safe_restart`                                                                                                                                                                                                                                             |

## Security / Production safety

- **All 38 tools are exposed by default**, including write and destructive ones (trigger/stop/delete builds, create/delete/rename jobs, quiet down, restart). Nothing is read-only unless you make it so.
- **Prefer an allowlist** (`MCP_JENKINS_ALLOW_TOOLS`) to lock the server down to what you actually need — it is enforced for both `tools/list` and `tools/call`. A blocklist (`MCP_JENKINS_BLOCK_TOOLS`) works, but any write tool added in a future release is exposed until you update your list.
- **Use a dedicated, least-privilege Jenkins identity** — the server can do everything its credentials can do.
- **Pin a reviewed version** (e.g. `@daxiong888/mcp-jenkins@3.0.0`) for production or any write-capable setup; `@latest` is intended for evaluation and quick trials.
- **Keep credentials off the command line entirely**: `--api-token` / `--bearer-token` flags leak into process lists, and any interactive command carrying a token — including `VAR=value` prefixes — lands in shell history. Inject credentials via your MCP client's `env` config or a secret manager, and never commit tokens to version control or print them to logs.

## Validation status (3.0.0-rc.1)

Evidence recorded on 2026-08-27 for the published release candidate. The
scope limits below are part of the result:

| Layer | Verified evidence |
| --- | --- |
| Local quality gates | `npm test` (23 files, 244 tests), `npm run typecheck`, and `npm run build` passed on macOS arm64 with Node.js v24.11.1. |
| Node.js support | [GitHub Actions run 33042439411](https://github.com/daxiong888/mcp-jenkins/actions/runs/33042439411) passed `npm ci`, typecheck, build, and all tests on Node.js 20, 22, and 24. Node.js v24.11.1 is also locally verified on macOS arm64. |
| Jenkins integration | `npm run test:integration:docker:matrix` passed with Jenkins 2.411, 2.477, and 2.568.2 images pinned by digest. Each leg boots two disposable local controllers, asserts both reported versions, and exercises explicit instance routing and credential isolation. |
| Published package | The npm Registry `next` package was downloaded and matched the published SHA-1 `e593281fcc00ce4783f25fde7c60d8797d1473a3`. A clean install completed an MCP stdio `initialize` handshake as `3.0.0-rc.1`, listed 38 tools, and did not expose the test URL or credentials on stderr. |

The Docker matrix exercises job create/update/copy/rename/enable/disable/delete,
build trigger/stop/delete, queue cancellation, node offline/online round trips,
quiet-down recovery, safe restart, and crumb refresh after a controller restart.

Replay is covered by unit/mock tests but is not included in the Docker matrix:
the stock controller images do not include the Pipeline/Workflow plugins needed
to create and replay a Pipeline job. No write request was sent to a real Jenkins
instance. Real plugin sets, authentication/authorization policies, SSO, and
reverse-proxy behaviour were not reproduced by the disposable Docker tests.

## Development

```sh
git clone https://github.com/daxiong888/mcp-jenkins.git
cd mcp-jenkins
npm install
npm run dev
```

To test interactively with the MCP Inspector:

```sh
npm run inspect:dev
```

📚 **Full documentation → [mcp-jenkins/docs](https://github.com/daxiong888/mcp-jenkins/tree/main/docs)**
