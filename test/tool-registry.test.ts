import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { rawTools } from "../src/tool-manifest.js"

describe("tool registry", () => {
  it("keeps every advertised tool backed by exactly one handler", () => {
    const source = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8")
    const registry = source.match(
      /const toolHandlers: Record<string, ToolHandler> = \{([\s\S]*?)\n\}/,
    )

    expect(registry, "toolHandlers registry not found in src/index.ts").not.toBeNull()
    const handlerNames = Array.from(
      registry![1].matchAll(/^\s+(jenkins_[a-z0-9_]+):/gm),
      (match) => match[1],
    )
    const advertisedNames = rawTools.map((tool) => tool.name)

    expect(new Set(handlerNames).size).toBe(handlerNames.length)
    expect([...handlerNames, "jenkins_list_instances"].sort()).toEqual(
      advertisedNames.sort(),
    )
  })
})
