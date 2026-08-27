# mcp-jenkins

## API Reference

Official API docs: https://www.jenkins.io/doc/book/using/remote-access-api/

## Distribution

The independent package identity is `@daxiong888/mcp-jenkins`; the published release candidate runs as an stdio server via `npx --yes @daxiong888/mcp-jenkins@next`, a global install, or `/plugin install`. The client spawns and owns the process. The original project remains attributed in `LICENSE`, `README.md`, and `CHANGELOG.md`.

Container packaging (Dockerfile, ghcr publishing) is therefore out of scope: images serve remote or containerised MCP hosting, where something else manages the process lifecycle. That is not how this server is consumed, so an image would be a release surface with no users behind it. Decline such contributions with the reason rather than a bare "no" — see PR #15.

## Public surface

`JenkinsClient` is a public API in its own right, not just the backing for the tool layer. Validate inputs and defaults in the client, not only in the JSON schemas — a schema constrains MCP callers, not direct importers.

Changing a default in `JenkinsClient` is a breaking change that no call site reveals: `listJobs(input)` and `listJobs()` type-check identically and produce no diff at any consumer. Any PR that moves a default needs a test asserting how the _previous_ contract now behaves, not only tests for the new path.
