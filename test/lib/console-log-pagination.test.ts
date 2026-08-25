import { afterEach, describe, expect, it, vi } from "vitest"
import { JenkinsClient } from "../../src/lib/jenkins-client.js"

describe("console log pagination", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("re-reads look-ahead bytes from the returned cursor", async () => {
    const completeLog = new TextEncoder().encode("123456789")
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      const start = Number(url.searchParams.get("start") ?? 0)
      return new Response(completeLog.slice(start), {
        status: 200,
        headers: {
          "x-text-size": String(completeLog.byteLength),
          "x-more-data": "false",
        },
      })
    })
    vi.stubGlobal("fetch", fetchMock)
    const client = new JenkinsClient({
      baseUrl: "https://jenkins.example.com",
    })

    const first = await client.getConsoleLog("job", 1, 20, undefined, 5)
    expect(first.logChunk).toBe("12345")
    expect(first.hasMore).toBe(true)
    expect(first.nextCursor).toEqual(expect.any(String))

    const second = await client.getConsoleLog(
      "job",
      1,
      20,
      first.nextCursor ?? undefined,
      5,
    )
    expect(second.logChunk).toBe("6789")
    expect(second.hasMore).toBe(false)
    expect(second.nextCursor).toBeNull()
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://jenkins.example.com/job/job/1/logText/progressiveText?start=5",
      expect.anything(),
    )
  })
})
