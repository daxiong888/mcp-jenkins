import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const releaseWorkflow = readFileSync(
  new URL("../.github/workflows/release.yml", import.meta.url),
  "utf8",
)

describe("release workflow safety", () => {
  it("uses manual dispatch as the only publication trigger", () => {
    expect(releaseWorkflow).toMatch(/^on:\n  workflow_dispatch:/m)
    expect(releaseWorkflow).not.toMatch(/^  push:/m)
    expect(releaseWorkflow).toMatch(
      /release_tag:\n(?: {8}.+\n)* {8}required: true/,
    )
    expect(releaseWorkflow).toMatch(
      /confirm_publish:\n(?: {8}.+\n)* {8}required: true/,
    )
  })

  it("fails closed unless the explicit confirmation is exact", () => {
    expect(releaseWorkflow).toContain(
      "CONFIRM_PUBLISH: ${{ inputs.confirm_publish }}",
    )
    expect(releaseWorkflow).toContain(
      'if [ "$CONFIRM_PUBLISH" != "publish" ]; then',
    )
    expect(releaseWorkflow).toContain("exit 1")
    expect(releaseWorkflow).not.toContain("NPM_PUBLISH_ENABLED")

    const confirmationStep = releaseWorkflow.indexOf(
      "- name: Confirm explicit publication",
    )
    const checkoutStep = releaseWorkflow.indexOf("- uses: actions/checkout@v6")
    expect(confirmationStep).toBeGreaterThan(-1)
    expect(confirmationStep).toBeLessThan(checkoutStep)
  })

  it("publishes only the validated existing tag with provenance", () => {
    expect(releaseWorkflow).toContain(
      "RELEASE_REF: ${{ format('refs/tags/{0}', inputs.release_tag) }}",
    )
    expect(releaseWorkflow).toContain("ref: ${{ env.RELEASE_REF }}")
    expect(releaseWorkflow).toContain(
      'node scripts/verify-release-metadata.mjs "$RELEASE_TAG"',
    )
    expect(releaseWorkflow).toContain(
      'npm publish --access public --provenance --tag "$NPM_DIST_TAG"',
    )
  })
})
