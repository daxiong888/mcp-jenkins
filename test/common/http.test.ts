import { afterEach, describe, expect, it, vi } from "vitest"
import { McpError } from "../../src/common/errors.js"
import { httpPost } from "../../src/common/http.js"

const response = (status: number, body = "sensitive response body") =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ location: "/queue/item/1" }),
    text: vi.fn().mockResolvedValue(body),
  }) as unknown as Response

describe("httpPost", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([200, 201, 204])("accepts HTTP %s", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(status)))

    await expect(httpPost("https://jenkins.invalid/write")).resolves.toEqual({
      status,
      headers: { location: "/queue/item/1" },
    })
  })

  it("maps HTTP 401 to authentication failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(401)))

    await expect(httpPost("https://jenkins.invalid/write")).rejects.toMatchObject({
      code: "AUTH_FAILED",
      status: 401,
    })
  })

  it("maps HTTP 403 to permission failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(403)))

    await expect(httpPost("https://jenkins.invalid/write")).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
      status: 403,
    })
  })

  it.each([404, 500])(
    "throws a sanitized error for HTTP %s",
    async (status) => {
      const url = "https://jenkins.invalid/write?token=secret-token"
      const body = "private Jenkins response"
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(status, body)))

      const error = await httpPost(url, {
        headers: { Authorization: "Bearer secret-token" },
      }).catch((caught) => caught as McpError)

      expect(error).toBeInstanceOf(McpError)
      expect(error.status).toBe(status)
      expect(error.message).toContain(`HTTP ${status}`)
      expect(error.message).not.toContain(url)
      expect(error.message).not.toContain("secret-token")
      expect(error.message).not.toContain(body)
    },
  )

  it("preserves timeout mapping", async () => {
    const abortError = Object.assign(new Error("aborted"), {
      name: "AbortError",
    })
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError))

    await expect(httpPost("https://jenkins.invalid/write")).rejects.toMatchObject({
      code: "TIMEOUT",
      status: 504,
    })
  })

  it("preserves network failures", async () => {
    const networkError = new TypeError("fetch failed")
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(networkError))

    await expect(httpPost("https://jenkins.invalid/write")).rejects.toBe(
      networkError,
    )
  })
})
