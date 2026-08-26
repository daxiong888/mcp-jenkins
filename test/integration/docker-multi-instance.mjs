#!/usr/bin/env node
import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawn } from "node:child_process"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"

const JENKINS_IMAGE =
  "jenkins/jenkins@sha256:8547df3b0db2803d158ecc9499207a056bb30c23fddc18bb5b4a4dc14e77dd09"
const REPO_ROOT = resolve(new URL("../..", import.meta.url).pathname)
const runId = `${process.pid}-${Date.now()}`
const containers = [`mcp-jenkins-alpha-${runId}`, `mcp-jenkins-beta-${runId}`]
const credentials = [
  { user: "alpha-admin", password: "alpha-local-test-password" },
  { user: "beta-admin", password: "beta-local-test-password" },
]

const groovy = `
import hudson.security.FullControlOnceLoggedInAuthorizationStrategy
import hudson.security.HudsonPrivateSecurityRealm
import jenkins.model.Jenkins

def jenkins = Jenkins.get()
def realm = new HudsonPrivateSecurityRealm(false)
realm.createAccount(System.getenv("JENKINS_ADMIN_ID"), System.getenv("JENKINS_ADMIN_PASSWORD"))
jenkins.setSecurityRealm(realm)
jenkins.setAuthorizationStrategy(new FullControlOnceLoggedInAuthorizationStrategy(false))
jenkins.save()
`

const run = (command, args, { allowFailure = false } = {}) =>
  new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] })
    const stdout = []
    const stderr = []
    child.stdout.on("data", (chunk) => stdout.push(chunk))
    child.stderr.on("data", (chunk) => stderr.push(chunk))
    child.on("error", () => rejectRun(new Error(`${command} could not start`)))
    child.on("close", (code) => {
      const result = {
        code: code ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8").trim(),
        stderr: Buffer.concat(stderr).toString("utf8").trim(),
      }
      if (result.code !== 0 && !allowFailure) {
        rejectRun(new Error(`${command} ${args[0] ?? ""} failed with status ${result.code}`))
        return
      }
      resolveRun(result)
    })
  })

const docker = (args, options) => run("docker", args, options)

const basicAuth = ({ user, password }) =>
  `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`

const sleep = (milliseconds) =>
  new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds))

const waitForJenkins = async (url, credential) => {
  const deadline = Date.now() + 240_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/api/json`, {
        headers: { Authorization: basicAuth(credential) },
        signal: AbortSignal.timeout(3_000),
      })
      if (response.ok) return
    } catch {
      // Jenkins is still starting.
    }
    await sleep(1_000)
  }
  throw new Error("Timed out waiting for a local Jenkins test container")
}

const containerUrl = async (name) => {
  const result = await docker(["port", name, "8080/tcp"])
  const match = result.stdout.match(/127\.0\.0\.1:(\d+)/)
  assert(match, "Docker did not expose Jenkins on a loopback port")
  return `http://127.0.0.1:${match[1]}`
}

const startContainer = async (name, credential, groovyPath) => {
  await docker([
    "run",
    "--detach",
    "--rm",
    "--name",
    name,
    "--publish",
    "127.0.0.1::8080",
    "--env",
    `JENKINS_ADMIN_ID=${credential.user}`,
    "--env",
    `JENKINS_ADMIN_PASSWORD=${credential.password}`,
    "--env",
    "JAVA_OPTS=-Djenkins.install.runSetupWizard=false",
    "--volume",
    `${groovyPath}:/usr/share/jenkins/ref/init.groovy.d/security.groovy:ro`,
    JENKINS_IMAGE,
  ])
  return containerUrl(name)
}

const toolText = (result) => {
  const content = result.content?.find((item) => item.type === "text")
  assert(content && "text" in content, "MCP tool returned no text content")
  return JSON.parse(content.text)
}

const callOk = async (client, name, args) => {
  const result = await client.callTool({ name, arguments: args })
  if (result.isError === true) {
    const error = toolText(result)
    assert.fail(
      `${name} unexpectedly failed: ${error.code ?? "UNKNOWN"}: ${error.message ?? "no message"}`,
    )
  }
  return toolText(result)
}

const callError = async (client, name, args, code) => {
  const result = await client.callTool({ name, arguments: args })
  assert.equal(result.isError, true, `${name} unexpectedly succeeded`)
  const error = toolText(result)
  assert.equal(error.code, code)
  return error
}

const withMcpClient = async (env, callback) => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(REPO_ROOT, "dist/index.js")],
    cwd: REPO_ROOT,
    env: {
      PATH: process.env.PATH ?? "",
      LANG: "C.UTF-8",
      ...env,
    },
    stderr: "pipe",
  })
  const stderr = []
  transport.stderr?.on("data", (chunk) => stderr.push(chunk))
  const client = new Client(
    { name: "mcp-jenkins-docker-integration", version: "1.0.0" },
    { capabilities: {} },
  )
  try {
    await client.connect(transport)
    return await callback(client)
  } finally {
    await client.close()
    const log = Buffer.concat(stderr).toString("utf8")
    for (const credential of credentials) {
      assert(!log.includes(credential.user), "MCP stderr leaked a Jenkins user")
      assert(
        !log.includes(credential.password),
        "MCP stderr leaked a Jenkins password",
      )
    }
    assert(!log.includes("http://127.0.0.1"), "MCP stderr leaked a Jenkins URL")
  }
}

const jobConfig = (label, command = `printf '%s\\n' '${label}'`) => `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <actions/>
  <description>${label}</description>
  <keepDependencies>false</keepDependencies>
  <properties/>
  <scm class="hudson.scm.NullSCM"/>
  <canRoam>true</canRoam>
  <disabled>false</disabled>
  <blockBuildWhenDownstreamBuilding>false</blockBuildWhenDownstreamBuilding>
  <blockBuildWhenUpstreamBuilding>false</blockBuildWhenUpstreamBuilding>
  <triggers/>
  <concurrentBuild>false</concurrentBuild>
  <builders>
    <hudson.tasks.Shell>
      <command>${command}</command>
    </hudson.tasks.Shell>
  </builders>
  <publishers/>
  <buildWrappers/>
</project>`

const main = async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "mcp-jenkins-docker-"))
  const groovyPath = join(tempDir, "security.groovy")
  await writeFile(groovyPath, groovy, { mode: 0o600 })

  let urls = []
  try {
    urls = await Promise.all(
      containers.map((name, index) =>
        startContainer(name, credentials[index], groovyPath),
      ),
    )
    await Promise.all(
      urls.map((url, index) => waitForJenkins(url, credentials[index])),
    )

    const baseEnv = {
      MCP_JENKINS_INSTANCES: "alpha,beta",
      MCP_JENKINS_URL: urls.join(","),
      MCP_JENKINS_USER: credentials.map(({ user }) => user).join(","),
      MCP_JENKINS_API_TOKEN: credentials
        .map(({ password }) => password)
        .join(","),
      MCP_JENKINS_ALLOW_TOOLS: [
        "jenkins_list_instances",
        "jenkins_get_version",
        "jenkins_list_jobs",
        "jenkins_create_job",
        "jenkins_get_job_config",
        "jenkins_update_job_config",
        "jenkins_copy_job",
        "jenkins_rename_job",
        "jenkins_disable_job",
        "jenkins_enable_job",
        "jenkins_delete_job",
        "jenkins_trigger_build",
        "jenkins_get_build_status",
        "jenkins_get_console_log",
        "jenkins_quiet_down",
        "jenkins_cancel_quiet_down",
      ].join(","),
    }

    const versions = await withMcpClient(baseEnv, async (client) => {
      await assert.rejects(
        client.callTool({ name: "jenkins_get_version", arguments: {} }),
        /instance is required/,
      )

      const configured = await callOk(client, "jenkins_list_instances", {})
      assert.deepEqual(
        configured.map(({ name }) => name),
        ["alpha", "beta"],
      )

      const alphaVersion = await callOk(client, "jenkins_get_version", {
        instance: "alpha",
      })
      const betaVersion = await callOk(client, "jenkins_get_version", {
        instance: "beta",
      })
      assert.notEqual(alphaVersion.version, "unknown")
      assert.equal(betaVersion.version, alphaVersion.version)

      for (const instance of ["alpha", "beta"]) {
        const jobs = await callOk(client, "jenkins_list_jobs", { instance })
        assert.deepEqual(jobs, [])
      }

      await callOk(client, "jenkins_create_job", {
        instance: "alpha",
        jobName: "shared-job",
        configXml: jobConfig("alpha-owner"),
      })
      await callOk(client, "jenkins_create_job", {
        instance: "beta",
        jobName: "shared-job",
        configXml: jobConfig("beta-owner"),
      })

      const alphaConfig = await callOk(client, "jenkins_get_job_config", {
        instance: "alpha",
        jobName: "shared-job",
      })
      const betaConfig = await callOk(client, "jenkins_get_job_config", {
        instance: "beta",
        jobName: "shared-job",
      })
      assert.match(alphaConfig.config, /alpha-owner/)
      assert.doesNotMatch(alphaConfig.config, /beta-owner/)
      assert.match(betaConfig.config, /beta-owner/)

      await callOk(client, "jenkins_update_job_config", {
        instance: "alpha",
        jobName: "shared-job",
        configXml: jobConfig("alpha-updated"),
      })
      await callError(
        client,
        "jenkins_update_job_config",
        {
          instance: "alpha",
          jobName: "missing-job",
          configXml: jobConfig("never-created"),
        },
        "JOB_NOT_FOUND",
      )

      await callOk(client, "jenkins_copy_job", {
        instance: "alpha",
        fromName: "shared-job",
        newName: "copied-job",
      })
      await callOk(client, "jenkins_rename_job", {
        instance: "alpha",
        jobName: "copied-job",
        newName: "renamed-job",
      })
      await callOk(client, "jenkins_disable_job", {
        instance: "alpha",
        jobName: "renamed-job",
      })
      await callOk(client, "jenkins_enable_job", {
        instance: "alpha",
        jobName: "renamed-job",
      })

      const logCommand =
        "i=1; while [ $i -le 600 ]; do printf 'alpha-日志-%04d\\n' $i; i=$((i+1)); done"
      await callOk(client, "jenkins_create_job", {
        instance: "alpha",
        jobName: "build-job",
        configXml: jobConfig("build-owner", logCommand),
      })
      const queued = await callOk(client, "jenkins_trigger_build", {
        instance: "alpha",
        jobName: "build-job",
      })
      assert(Number.isInteger(queued.queueId) && queued.queueId > 0)

      let build
      const deadline = Date.now() + 90_000
      while (Date.now() < deadline) {
        try {
          build = await callOk(client, "jenkins_get_build_status", {
            instance: "alpha",
            jobName: "build-job",
            buildNumber: 1,
          })
          if (build.result !== "RUNNING") break
        } catch {
          // The queue item has not created build #1 yet.
        }
        await sleep(500)
      }
      assert.equal(build?.result, "SUCCESS")

      let cursor
      let combinedLog = ""
      for (let page = 0; page < 200; page += 1) {
        const chunk = await callOk(client, "jenkins_get_console_log", {
          instance: "alpha",
          jobName: "build-job",
          buildNumber: 1,
          maxBytes: 512,
          ...(cursor ? { cursor } : {}),
        })
        combinedLog += chunk.logChunk
        assert.equal(chunk.fullLog, chunk.logChunk)
        cursor = chunk.nextCursor
        if (!chunk.hasMore) break
      }
      assert.equal(cursor, null)
      assert.match(combinedLog, /alpha-日志-0001/)
      assert.match(combinedLog, /alpha-日志-0600/)

      await callOk(client, "jenkins_quiet_down", {
        instance: "alpha",
        confirm: true,
        reason: "local integration test",
      })
      await callOk(client, "jenkins_cancel_quiet_down", {
        instance: "alpha",
      })

      for (const jobName of ["renamed-job", "build-job", "shared-job"]) {
        await callOk(client, "jenkins_delete_job", {
          instance: "alpha",
          jobName,
        })
      }
      await callOk(client, "jenkins_delete_job", {
        instance: "beta",
        jobName: "shared-job",
      })

      return [alphaVersion.version, betaVersion.version]
    })

    const swappedEnv = {
      ...baseEnv,
      MCP_JENKINS_API_TOKEN: credentials
        .map(({ password }) => password)
        .reverse()
        .join(","),
      MCP_JENKINS_ALLOW_TOOLS: "jenkins_get_version",
    }
    await withMcpClient(swappedEnv, async (client) => {
      await callError(
        client,
        "jenkins_get_version",
        { instance: "alpha" },
        "AUTH_FAILED",
      )
      await callError(
        client,
        "jenkins_get_version",
        { instance: "beta" },
        "AUTH_FAILED",
      )
    })

    process.stdout.write(
      `${JSON.stringify(
        {
          result: "passed",
          node: process.version,
          platform: `${process.platform}-${process.arch}`,
          image: JENKINS_IMAGE,
          jenkinsVersions: versions,
          instances: 2,
          realJenkinsAccessed: false,
        },
        null,
        2,
      )}\n`,
    )
  } finally {
    await Promise.all(
      containers.map((name) => docker(["rm", "--force", name], { allowFailure: true })),
    )
    await rm(tempDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  process.stderr.write(`Docker integration failed: ${error.message}\n`)
  process.exitCode = 1
})
