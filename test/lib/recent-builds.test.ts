import { describe, it, expect, vi, afterEach } from "vitest"
import { JenkinsClient } from "../../src/lib/jenkins-client.js"

const makeClient = () =>
  new JenkinsClient({
    baseUrl: "https://jenkins.invalid",
    authHeader: "Bearer test-token",
  })

const buildsResponse = (count: number) =>
  new Response(
    JSON.stringify({
      builds: Array.from({ length: count }, (_, i) => ({
        number: 100 - i,
        result: "SUCCESS",
        duration: 5000,
        timestamp: 1698768000000,
        url: `https://jenkins.invalid/job/release/${100 - i}/`,
        building: false,
      })),
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  )

describe("JenkinsClient.getRecentBuilds bounded queries", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("asks Jenkins for only the needed fields and rows", async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildsResponse(2))
    vi.stubGlobal("fetch", fetchMock)

    const builds = await makeClient().getRecentBuilds("release", 2)

    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/job/release/api/json?tree=builds[number,id,result,building,duration,timestamp,url]{0,2}",
    )
    expect(builds).toHaveLength(2)
    expect(builds[0]).toMatchObject({
      id: "100",
      result: "SUCCESS",
      durationMs: 5000,
      timestamp: "2023-10-31T16:00:00.000Z",
      url: "https://jenkins.invalid/job/release/100/",
    })
  })

  it("keeps the nested job path legal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildsResponse(1))
    vi.stubGlobal("fetch", fetchMock)

    await makeClient().getRecentBuilds("folder/sub/release", 1)
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/job/folder/job/sub/job/release/api/json?tree=",
    )
  })

  it("defaults to 5", async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildsResponse(5))
    vi.stubGlobal("fetch", fetchMock)

    await makeClient().getRecentBuilds("release")
    expect(String(fetchMock.mock.calls[0][0])).toContain("{0,5}")
  })

  it.each([1, 100])("accepts limit %s", async (limit) => {
    const fetchMock = vi.fn().mockResolvedValue(buildsResponse(1))
    vi.stubGlobal("fetch", fetchMock)

    await makeClient().getRecentBuilds("release", limit)
    expect(String(fetchMock.mock.calls[0][0])).toContain(`{0,${limit}}`)
  })

  it.each([0, 101, 1.5, Number.NaN])(
    "rejects limit %s before any request is sent",
    async (limit) => {
      const fetchMock = vi.fn()
      vi.stubGlobal("fetch", fetchMock)

      await expect(
        makeClient().getRecentBuilds("release", limit),
      ).rejects.toMatchObject({ code: "INVALID_INPUT", status: 400 })
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it("still maps HTTP 404 to job not found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 404 })),
    )

    await expect(
      makeClient().getRecentBuilds("missing", 2),
    ).rejects.toMatchObject({ code: "JOB_NOT_FOUND", status: 404 })
  })
})
