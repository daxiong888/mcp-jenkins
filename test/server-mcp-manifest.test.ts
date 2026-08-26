import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { rawTools } from "../src/tool-manifest.js"

const require = createRequire(import.meta.url)
const pkg = require("../package.json") as {
  name: string
  version: string
  repository: { url: string }
  homepage: string
  bugs: { url: string }
  publishConfig: { access: string }
}
const packageLock = require("../package-lock.json") as {
  name: string
  version: string
  packages: Record<string, { name?: string; version?: string }>
}
const serverManifest = JSON.parse(
  readFileSync(new URL("../server.mcp.json", import.meta.url), "utf8"),
) as { version: string; tools: { name: string; description: string }[] }

describe("server.mcp.json consistency", () => {
  it("uses the independent fork package identity", () => {
    expect(pkg).toMatchObject({
      name: "@daxiong888/mcp-jenkins",
      repository: {
        url: "git+https://github.com/daxiong888/mcp-jenkins.git",
      },
      homepage: "https://github.com/daxiong888/mcp-jenkins#readme",
      bugs: {
        url: "https://github.com/daxiong888/mcp-jenkins/issues",
      },
      publishConfig: { access: "public" },
    })
  })

  it("keeps the lockfile root identity synchronized", () => {
    expect(packageLock.name).toBe(pkg.name)
    expect(packageLock.version).toBe(pkg.version)
    expect(packageLock.packages[""]).toMatchObject({
      name: pkg.name,
      version: pkg.version,
    })
  })

  it("reports the package version", () => {
    expect(serverManifest.version).toBe(pkg.version)
  })

  it("mirrors the production tool manifest in order", () => {
    expect(serverManifest.tools).toEqual(
      rawTools.map((t) => ({ name: t.name, description: t.description })),
    )
  })
})
