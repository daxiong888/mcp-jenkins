import { describe, expect, it } from "vitest"
import {
  EXPECTED_PACKAGE_NAME,
  verifyReleaseMetadata,
} from "../scripts/verify-release-metadata.mjs"

describe("release metadata verification", () => {
  it("routes prereleases to the next dist-tag", () => {
    expect(
      verifyReleaseMetadata(
        { name: EXPECTED_PACKAGE_NAME, version: "3.0.0-rc.1" },
        "v3.0.0-rc.1",
      ),
    ).toEqual({
      name: EXPECTED_PACKAGE_NAME,
      version: "3.0.0-rc.1",
      distTag: "next",
    })
  })

  it("routes stable versions to the latest dist-tag", () => {
    expect(
      verifyReleaseMetadata(
        { name: EXPECTED_PACKAGE_NAME, version: "3.0.0" },
        "v3.0.0",
      ).distTag,
    ).toBe("latest")
  })

  it("rejects an unexpected package scope", () => {
    expect(() =>
      verifyReleaseMetadata(
        { name: "@kud/mcp-jenkins", version: "3.0.0-rc.1" },
        "v3.0.0-rc.1",
      ),
    ).toThrow("unexpected package name")
  })

  it("rejects a tag that does not match package.json", () => {
    expect(() =>
      verifyReleaseMetadata(
        { name: EXPECTED_PACKAGE_NAME, version: "3.0.0-rc.1" },
        "v3.0.0",
      ),
    ).toThrow("does not match package version")
  })
})
