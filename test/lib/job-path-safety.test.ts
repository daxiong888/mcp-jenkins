import { describe, it, expect, vi, afterEach } from "vitest"
import { JenkinsClient } from "../../src/lib/jenkins-client.js"

const makeClient = () =>
  new JenkinsClient({
    baseUrl: "https://jenkins.invalid",
    authHeader: "Bearer test-token",
  })

describe("JenkinsClient job path safety", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each(["../victim", "folder/../../victim", "a/./b"])(
    "deleteJob(%s) is rejected before any request is sent",
    async (jobName) => {
      const fetchMock = vi.fn()
      vi.stubGlobal("fetch", fetchMock)

      await expect(makeClient().deleteJob(jobName)).rejects.toMatchObject({
        code: "INVALID_INPUT",
        status: 400,
      })
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it("rejects dot segments on read paths without issuing a request", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      makeClient().getJobConfig("folder/../victim"),
    ).rejects.toMatchObject({ code: "INVALID_INPUT", status: 400 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects dot segments in create/copy full names", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("not found", { status: 404 }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      makeClient().createJob("folder/../evil", "<project/>"),
    ).rejects.toMatchObject({ code: "INVALID_INPUT", status: 400 })
    // Only the crumb probe may have run; no createItem request went out.
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).toContain("/crumbIssuer/")
    }
  })

  it("accepts ordinary nested job names", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("<project/>", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await makeClient().getJobConfig("folder/sub/release")
    expect(result.config).toBe("<project/>")
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://jenkins.invalid/job/folder/job/sub/job/release/config.xml",
    )
  })
})
