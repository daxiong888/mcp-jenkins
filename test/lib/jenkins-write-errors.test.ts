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

  it("propagates a forbidden trigger-build response instead of reporting success", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(404))
        .mockResolvedValueOnce(response(403)),
    )
    const client = new JenkinsClient({
      baseUrl: "https://jenkins.invalid",
      authHeader: "Bearer secret-token",
    })

    await expect(client.triggerBuild("release-job")).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
      status: 403,
    })
  })
})
