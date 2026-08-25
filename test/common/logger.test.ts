import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { logger } from "../../src/common/logger.js"

describe("logger", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>
  let stdoutSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("writes to stderr, never stdout", () => {
    logger.info("test message")
    expect(stderrSpy).toHaveBeenCalledOnce()
    expect(stdoutSpy).not.toHaveBeenCalled()
  })

  it("emits valid JSON", () => {
    logger.info("hello")
    const raw = stderrSpy.mock.calls[0][0] as string
    expect(() => JSON.parse(raw)).not.toThrow()
  })

  it("includes level, msg, and time fields", () => {
    logger.warn("something happened")
    const entry = JSON.parse(stderrSpy.mock.calls[0][0] as string)
    expect(entry.level).toBe("warn")
    expect(entry.msg).toBe("something happened")
    expect(entry.time).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it("includes fields when provided", () => {
    logger.error("job failed", { job: "my-job", build: 42 })
    const entry = JSON.parse(stderrSpy.mock.calls[0][0] as string)
    expect(entry.fields).toEqual({ job: "my-job", build: 42 })
  })

  it("omits fields key when no fields provided", () => {
    logger.info("no fields")
    const entry = JSON.parse(stderrSpy.mock.calls[0][0] as string)
    expect(entry).not.toHaveProperty("fields")
  })

  it("maps info/warn/error to correct level values", () => {
    logger.info("a")
    logger.warn("b")
    logger.error("c")

    const levels = stderrSpy.mock.calls.map(
      (call) => JSON.parse(call[0] as string).level,
    )
    expect(levels).toEqual(["info", "warn", "error"])
  })

  it("redacts Jenkins connection and response secrets", () => {
    logger.error("failed at https://private.jenkins.example.com/job/release", {
      url: "https://private.jenkins.example.com",
      username: "private-user",
      apiToken: "private-api-token",
      headers: { Authorization: "Bearer private-auth-token" },
      responseBody: "private-response-body",
      detail: "Bearer private-detail-token",
    })

    const raw = stderrSpy.mock.calls[0][0] as string
    expect(raw).not.toContain("private.jenkins.example.com")
    expect(raw).not.toContain("private-user")
    expect(raw).not.toContain("private-api-token")
    expect(raw).not.toContain("private-auth-token")
    expect(raw).not.toContain("private-response-body")
    expect(raw).not.toContain("private-detail-token")
  })
})
