import { createRequire } from "node:module"
import { describe, expect, it } from "vitest"
import { serverInfo } from "../src/server-info.js"

const packageJson = createRequire(import.meta.url)("../package.json") as {
  version: string
}

describe("serverInfo", () => {
  it("reports the package version", () => {
    expect(serverInfo.version).toBe(packageJson.version)
  })
})
