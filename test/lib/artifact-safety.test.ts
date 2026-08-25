import { describe, it, expect, vi, afterEach } from "vitest"
import { JenkinsClient } from "../../src/lib/jenkins-client.js"

const makeClient = () =>
  new JenkinsClient({
    baseUrl: "https://jenkins.invalid",
    authHeader: "Bearer test-token",
  })

// Bytes that cannot survive a UTF-8 decode/encode round-trip.
const BINARY = [0x00, 0xff, 0xfe, 0x80, 0x61, 0xc3, 0x28, 0x7f]

describe("JenkinsClient artifact handling", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns base64 that decodes to the exact original bytes", async () => {
    const bytes = new Uint8Array(BINARY)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(bytes, { status: 200 })),
    )

    const result = await makeClient().getArtifact("job", 7, "dist/app.bin")
    expect(Buffer.from(result.base64, "base64")).toEqual(Buffer.from(bytes))
    expect(result.size).toBe(bytes.length)
    expect(result.relativePath).toBe("dist/app.bin")
    expect(result.fileName).toBe("app.bin")
  })

  it("encodes each path segment of a legal nested artifact path", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(new Uint8Array([0x41]), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await makeClient().getArtifact("job", 7, "dist/some dir/app+file.jar")
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://jenkins.invalid/job/job/7/artifact/dist/some%20dir/app%2Bfile.jar",
    )
  })

  it.each([
    "../secret",
    "a/../../secret",
    "/etc/passwd",
    "a//b",
    "a/./b",
    "dist\\app.jar",
    "",
  ])("rejects %s before any request is sent", async (relativePath) => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      makeClient().getArtifact("job", 7, relativePath),
    ).rejects.toMatchObject({ code: "INVALID_INPUT", status: 400 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("listArtifacts encodes the URL but keeps the raw relativePath", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            artifacts: [
              { fileName: "a b.jar", relativePath: "dist/a b.jar" },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    )

    const artifacts = await makeClient().listArtifacts("job", 7)
    expect(artifacts[0].relativePath).toBe("dist/a b.jar")
    expect(artifacts[0].url).toBe(
      "https://jenkins.invalid/job/job/7/artifact/dist/a%20b.jar",
    )
  })
})
