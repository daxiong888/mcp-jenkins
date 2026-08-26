import { afterEach, describe, expect, it, vi } from "vitest"
import { JenkinsClient } from "../../src/lib/jenkins-client.js"

const response = (status: number) =>
  new Response(null, {
    status,
    headers: status === 201 ? { location: "/queue/item/1" } : undefined,
  })

describe("JenkinsClient write failures", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("propagates a forbidden trigger-build response after one crumb refresh", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(404))
      .mockResolvedValueOnce(response(403))
      .mockResolvedValueOnce(response(404))
      .mockResolvedValueOnce(response(403))
    vi.stubGlobal("fetch", fetchMock)
    const client = new JenkinsClient({
      baseUrl: "https://jenkins.invalid",
      authHeader: "Bearer secret-token",
    })

    await expect(client.triggerBuild("release-job")).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
      status: 403,
    })
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
})
