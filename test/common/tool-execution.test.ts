import { describe, expect, it, vi } from "vitest"
import { McpError } from "../../src/common/errors.js"
import { invokeToolHandler } from "../../src/common/tool-execution.js"

describe("invokeToolHandler", () => {
  it("returns successful handler values as text content", async () => {
    const result = await invokeToolHandler(
      "jenkins_get_status",
      vi.fn().mockResolvedValue({ status: "ok" }),
      {},
      {},
    )

    expect(result.isError).toBeUndefined()
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "ok" })
  })

  it("returns Jenkins execution failures as sanitized tool errors", async () => {
    const result = await invokeToolHandler(
      "jenkins_trigger_build",
      vi.fn().mockRejectedValue(new McpError("PERMISSION_DENIED", "Forbidden", 403)),
      {},
      {},
    )

    expect(result.isError).toBe(true)
    expect(JSON.parse(result.content[0].text)).toEqual({
      error: "Forbidden",
      code: "PERMISSION_DENIED",
    })
  })

  it("does not expose unexpected exception details", async () => {
    const result = await invokeToolHandler(
      "jenkins_trigger_build",
      vi.fn().mockRejectedValue(new Error("token=private-value")),
      {},
      {},
    )

    expect(result.isError).toBe(true)
    expect(result.content[0].text).not.toContain("private-value")
    expect(JSON.parse(result.content[0].text)).toEqual({
      error: "Unexpected error",
      code: "UNEXPECTED",
    })
  })
})
