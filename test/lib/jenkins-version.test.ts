import { describe, it, expect, vi, afterEach } from "vitest"
import { JenkinsClient } from "../../src/lib/jenkins-client.js"

const makeClient = () =>
  new JenkinsClient({
    baseUrl: "https://jenkins.invalid",
    authHeader: "Bearer test-token",
  })

const headResponse = (status: number, headers: Record<string, string> = {}) =>
  new Response(null, { status, headers })

describe("JenkinsClient.getVersion", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("reads the x-jenkins header from a HEAD response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(headResponse(200, { "x-jenkins": "2.462.3" })),
    )

    await expect(makeClient().getVersion()).resolves.toEqual({
      version: "2.462.3",
    })
  })

  it("reports unknown when the header is absent on a 200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(headResponse(200)))

    await expect(makeClient().getVersion()).resolves.toEqual({
      version: "unknown",
    })
  })

  it.each([
    [401, "AUTH_FAILED"],
    [403, "PERMISSION_DENIED"],
    [500, "HTTP_ERROR"],
  ])("propagates HTTP %s as %s instead of unknown", async (status, code) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(headResponse(status)))

    await expect(makeClient().getVersion()).rejects.toMatchObject({
      code,
      status,
    })
  })
})
