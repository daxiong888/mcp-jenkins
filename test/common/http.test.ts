import { afterEach, describe, expect, it, vi } from "vitest"
import { McpError } from "../../src/common/errors.js"
import {
  httpGetJson,
  httpGetText,
  httpGetTextChunk,
  httpGetBuffer,
  httpHead,
  httpPost,
} from "../../src/common/http.js"

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

describe("httpGetTextChunk", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("stops reading after the byte limit and reports a truncated chunk", async () => {
    const cancel = vi.fn()
    const chunks = [
      new TextEncoder().encode("first line\nsecond line\n"),
      new TextEncoder().encode("unread tail\n"),
    ]
    const read = vi
      .fn()
      .mockResolvedValueOnce({ done: false, value: chunks[0] })
      .mockResolvedValueOnce({ done: false, value: chunks[1] })
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "x-text-size": "4096" }),
        body: { getReader: () => ({ read, cancel }) },
      } as unknown as Response),
    )

    const result = await httpGetTextChunk(
      "https://jenkins.invalid/logText/progressiveText?start=0",
      12,
    )

    expect(Buffer.byteLength(result.text)).toBeLessThanOrEqual(12)
    expect(result.byteLength).toBe(Buffer.byteLength(result.text))
    expect(result.truncated).toBe(true)
    expect(result.headers["x-text-size"]).toBe("4096")
    expect(cancel).toHaveBeenCalled()
  })

  it("does not advance the byte cursor through a split UTF-8 code point", async () => {
    const cancel = vi.fn()
    const read = vi.fn().mockResolvedValueOnce({
      done: false,
      value: new TextEncoder().encode("abc🙂def"),
    })
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        body: { getReader: () => ({ read, cancel }) },
      } as unknown as Response),
    )

    const result = await httpGetTextChunk(
      "https://jenkins.invalid/logText/progressiveText?start=0",
      5,
    )

    expect(result.text).toBe("abc")
    expect(result.byteLength).toBe(3)
    expect(result.truncated).toBe(true)
  })
})

const readResponse = (status: number, body = "sensitive response body") =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "x-jenkins": "2.462.3" }),
    json: vi.fn().mockResolvedValue({ parsed: body }),
    text: vi.fn().mockResolvedValue(body),
    arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode(body).buffer),
  }) as unknown as Response

const readHelpers = [
  ["httpGetJson", httpGetJson],
  ["httpGetText", httpGetText],
  ["httpGetBuffer", httpGetBuffer],
] as const

describe.each(readHelpers)("%s", (_name, helper) => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("accepts HTTP 200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(readResponse(200)))
    await expect(
      helper("https://jenkins.invalid/api/json"),
    ).resolves.toBeDefined()
  })

  it.each([
    [401, "AUTH_FAILED"],
    [403, "PERMISSION_DENIED"],
    [404, "HTTP_ERROR"],
    [500, "HTTP_ERROR"],
  ])("maps HTTP %s to %s without leaking URL or body", async (status, code) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(readResponse(status)))

    const error = await helper(
      "https://jenkins.invalid/read?token=secret-token",
      { headers: { Authorization: "Bearer secret-token" } },
    ).catch((caught) => caught as McpError)

    expect(error).toBeInstanceOf(McpError)
    expect(error.code).toBe(code)
    expect(error.status).toBe(status)
    expect(error.message).not.toContain("secret-token")
    expect(error.message).not.toContain("jenkins.invalid")
    expect(error.message).not.toContain("sensitive response body")
  })

  it("preserves timeout mapping", async () => {
    const abortError = Object.assign(new Error("aborted"), {
      name: "AbortError",
    })
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError))

    await expect(helper("https://jenkins.invalid/read")).rejects.toMatchObject({
      code: "TIMEOUT",
      status: 504,
    })
  })

  it("preserves network failures", async () => {
    const networkError = new TypeError("fetch failed")
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(networkError))

    await expect(helper("https://jenkins.invalid/read")).rejects.toBe(
      networkError,
    )
  })
})

describe("httpHead", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns status and headers on HTTP 200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(readResponse(200)))

    const res = await httpHead("https://jenkins.invalid/api/json")
    expect(res.status).toBe(200)
    expect(res.headers["x-jenkins"]).toBe("2.462.3")
  })

  it.each([
    [401, "AUTH_FAILED"],
    [403, "PERMISSION_DENIED"],
    [500, "HTTP_ERROR"],
  ])("maps HTTP %s to %s", async (status, code) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(readResponse(status)))

    await expect(
      httpHead("https://jenkins.invalid/api/json?token=secret-token"),
    ).rejects.toMatchObject({ code, status })
  })

  it("preserves timeout mapping", async () => {
    const abortError = Object.assign(new Error("aborted"), {
      name: "AbortError",
    })
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError))

    await expect(
      httpHead("https://jenkins.invalid/api/json"),
    ).rejects.toMatchObject({ code: "TIMEOUT", status: 504 })
  })

  it("preserves network failures", async () => {
    const networkError = new TypeError("fetch failed")
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(networkError))

    await expect(httpHead("https://jenkins.invalid/api/json")).rejects.toBe(
      networkError,
    )
  })
})
