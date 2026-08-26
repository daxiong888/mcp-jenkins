import { afterEach, describe, expect, it, vi } from "vitest"
import { JenkinsClient } from "../../src/lib/jenkins-client.js"

describe("console log pagination", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("reassembles the exact consoleText bytes across UTF-8 boundaries", async () => {
    const completeLog = "first\r\n第二行\nthird🙂line\r\n"
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      if (String(input).endsWith("/api/json")) {
        return Response.json({ number: 1, building: false, result: "SUCCESS" })
      }
      return new Response(completeLog)
    })
    vi.stubGlobal("fetch", fetchMock)
    const client = new JenkinsClient({
      baseUrl: "https://jenkins.example.com",
    })

    const chunks: string[] = []
    let cursor: string | undefined
    do {
      const page = await client.getConsoleLog("job", 1, 20, cursor, 5)
      chunks.push(page.logChunk)
      cursor = page.nextCursor ?? undefined
    } while (cursor)

    expect(chunks.join("")).toBe(completeLog)
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).endsWith("/consoleText"),
      ),
    ).toHaveLength(chunks.length)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://jenkins.example.com/job/job/1/api/json",
      expect.anything(),
    )
  })
})
