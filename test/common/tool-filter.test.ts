import { describe, it, expect } from "vitest"
import { McpError } from "../../src/common/errors.js"
import {
  exposedToolNames,
  assertToolExposed,
} from "../../src/common/tool-filter.js"

const exposed = exposedToolNames([
  { name: "jenkins_list_jobs" },
  { name: "jenkins_get_job_status" },
])

describe("exposedToolNames", () => {
  it("collects the exposed tool names", () => {
    expect([...exposed].sort()).toEqual([
      "jenkins_get_job_status",
      "jenkins_list_jobs",
    ])
  })
})

describe("assertToolExposed", () => {
  it("passes an allowed name through", () => {
    expect(() => assertToolExposed(exposed, "jenkins_list_jobs")).not.toThrow()
  })

  it("rejects a blocked or unlisted name as an unknown tool", () => {
    let error: McpError | undefined
    try {
      assertToolExposed(exposed, "jenkins_delete_job")
    } catch (caught) {
      error = caught as McpError
    }

    expect(error).toBeInstanceOf(McpError)
    expect(error?.code).toBe("TOOL_NOT_FOUND")
    expect(error?.status).toBe(404)
    expect(error?.message).not.toMatch(/block|filter|allow/i)
  })

  it("rejects jenkins_list_instances once it is filtered out", () => {
    expect(() => assertToolExposed(exposed, "jenkins_list_instances")).toThrow(
      "Unknown tool: jenkins_list_instances",
    )
    expect(() =>
      assertToolExposed(
        exposedToolNames([{ name: "jenkins_list_instances" }]),
        "jenkins_list_instances",
      ),
    ).not.toThrow()
  })
})
