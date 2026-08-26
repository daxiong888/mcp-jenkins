#!/usr/bin/env node
import { spawn } from "node:child_process"
import { join, resolve } from "node:path"

const REPO_ROOT = resolve(new URL("../..", import.meta.url).pathname)
const HARNESS = join(REPO_ROOT, "test/integration/docker-multi-instance.mjs")

// These multi-platform index digests include linux/arm64 and linux/amd64.
// Replay remains excluded because the official controller images do not ship
// the Pipeline/Workflow plugins required to create and replay Pipeline jobs.
const MATRIX = [
  {
    expectedVersion: "2.411",
    image:
      "jenkins/jenkins@sha256:261332e874bc7b2ae36b9401fb87867d5ddde96481692f4fc37027a533f877be",
  },
  {
    expectedVersion: "2.477",
    image:
      "jenkins/jenkins@sha256:1a2c9a8bf741d02608e7f31ed21fec2992da82d3573eca6499551010ecfc94d7",
  },
  {
    // The harness owns the pinned baseline digest so there is one source of
    // truth for the default quick integration test.
    expectedVersion: "2.568.2",
  },
]

const runLeg = (leg) =>
  new Promise((resolveLeg) => {
    const env = { ...process.env }
    delete env.MCP_JENKINS_TEST_IMAGE
    delete env.MCP_JENKINS_TEST_EXPECTED_VERSION
    if (leg.image) {
      env.MCP_JENKINS_TEST_IMAGE = leg.image
      env.MCP_JENKINS_TEST_EXPECTED_VERSION = leg.expectedVersion
    }

    const child = spawn(process.execPath, [HARNESS], {
      cwd: REPO_ROOT,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    })
    const stdout = []
    const stderr = []
    child.stdout.on("data", (chunk) => stdout.push(chunk))
    child.stderr.on("data", (chunk) => stderr.push(chunk))
    child.on("error", () => {
      resolveLeg({
        expectedVersion: leg.expectedVersion,
        result: "failed",
        exitCode: 1,
        failure: "Docker integration harness could not start",
      })
    })
    child.on("close", (code) => {
      const output = Buffer.concat(stdout).toString("utf8").trim()
      const errors = Buffer.concat(stderr).toString("utf8").trim()
      let details
      try {
        details = JSON.parse(output)
      } catch {
        details = undefined
      }
      const validVersions =
        Array.isArray(details?.jenkinsVersions) &&
        details.jenkinsVersions.length === 2 &&
        details.jenkinsVersions.every(
          (version) => version === leg.expectedVersion,
        )
      const passed =
        code === 0 && details?.result === "passed" && validVersions
      const failure = errors
        .split("\n")
        .find((line) => line.startsWith("Docker integration failed:"))
      resolveLeg({
        expectedVersion: leg.expectedVersion,
        result: passed ? "passed" : "failed",
        exitCode: passed ? 0 : (code ?? 1) || 1,
        image: details?.image ?? leg.image ?? "default pinned image",
        jenkinsVersions: details?.jenkinsVersions ?? [],
        ...(passed
          ? {}
          : {
              failure:
                failure ??
                (code === 0
                  ? "Docker integration returned an invalid result"
                  : `Docker integration exited with ${code}`),
            }),
      })
    })
  })

const results = []
for (const leg of MATRIX) {
  process.stdout.write(`Running Jenkins ${leg.expectedVersion} matrix leg\n`)
  results.push(await runLeg(leg))
}

const failed = results.some(({ result }) => result === "failed")
process.stdout.write(
  `${JSON.stringify(
    {
      result: failed ? "failed" : "passed",
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      matrix: results,
      realJenkinsAccessed: false,
    },
    null,
    2,
  )}\n`,
)
if (failed) process.exitCode = 1
