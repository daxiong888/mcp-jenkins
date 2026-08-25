import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { rawTools } from "../src/tool-manifest.js"

const require = createRequire(import.meta.url)
const pkg = require("../package.json") as { version: string }
const serverManifest = JSON.parse(
  readFileSync(new URL("../server.mcp.json", import.meta.url), "utf8"),
) as { version: string; tools: { name: string; description: string }[] }

describe("server.mcp.json consistency", () => {
  it("reports the package version", () => {
    expect(serverManifest.version).toBe(pkg.version)
  })

  it("mirrors the production tool manifest in order", () => {
    expect(serverManifest.tools).toEqual(
      rawTools.map((t) => ({ name: t.name, description: t.description })),
    )
  })
})
