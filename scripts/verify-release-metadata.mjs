#!/usr/bin/env node
import { readFileSync } from "node:fs"

export const EXPECTED_PACKAGE_NAME = "@daxiong888/mcp-jenkins"

export const verifyReleaseMetadata = (pkg, tag) => {
  if (pkg.name !== EXPECTED_PACKAGE_NAME) {
    throw new Error(`Refusing to publish unexpected package name: ${pkg.name}`)
  }

  const expectedTag = `v${pkg.version}`
  if (tag !== expectedTag) {
    throw new Error(
      `Release tag ${tag || "<missing>"} does not match package version ${expectedTag}`,
    )
  }

  return {
    name: pkg.name,
    version: pkg.version,
    distTag: pkg.version.includes("-") ? "next" : "latest",
  }
}

if (process.argv[1]?.endsWith("verify-release-metadata.mjs")) {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)))
  const result = verifyReleaseMetadata(pkg, process.argv[2])
  process.stdout.write(`NPM_DIST_TAG=${result.distTag}\n`)
}
