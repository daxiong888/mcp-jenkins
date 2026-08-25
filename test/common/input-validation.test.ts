import { describe, it, expect } from "vitest"
import { McpError } from "../../src/common/errors.js"
import { buildInputValidators } from "../../src/common/input-validation.js"
import { rawTools } from "../../src/tool-manifest.js"

const validators = buildInputValidators(rawTools)
const validate = (name: string, args: unknown) => validators.get(name)!(args)

const expectInvalidParams = (name: string, args: unknown): McpError => {
  try {
    validate(name, args)
  } catch (caught) {
    const error = caught as McpError
    expect(error).toBeInstanceOf(McpError)
    expect(error.code).toBe("INVALID_PARAMS")
    expect(error.status).toBe(400)
    return error
  }
  throw new Error(`expected ${name} to reject ${JSON.stringify(args)}`)
}

describe("buildInputValidators", () => {
  it("builds a validator for every advertised tool", () => {
    expect(validators.size).toBe(rawTools.length)
  })

  it("rejects a missing required argument", () => {
    expectInvalidParams("jenkins_get_build_status", { buildNumber: 5 })
  })

  it("rejects a wrongly typed string argument", () => {
    expectInvalidParams("jenkins_get_build_status", {
      jobName: 42,
      buildNumber: 5,
    })
  })

  it("rejects a string where a number is required", () => {
    expectInvalidParams("jenkins_get_build_status", {
      jobName: "release",
      buildNumber: "5",
    })
  })

  it.each([1.5, 0, -3])("rejects invalid buildNumber %s", (buildNumber) => {
    expectInvalidParams("jenkins_get_build_status", {
      jobName: "release",
      buildNumber,
    })
  })

  it.each([0, -1, 2.5])("rejects invalid queueId %s", (queueId) => {
    expectInvalidParams("jenkins_cancel_queue", { queueId })
  })

  it("accepts valid arguments", () => {
    expect(() =>
      validate("jenkins_get_build_status", {
        jobName: "folder/release",
        buildNumber: 5,
        instance: "ci",
      }),
    ).not.toThrow()
    expect(() =>
      validate("jenkins_trigger_build", {
        jobName: "release",
        params: { BRANCH: "main" },
      }),
    ).not.toThrow()
    expect(() => validate("jenkins_list_jobs", {})).not.toThrow()
  })

  it("never echoes argument values in the error message", () => {
    const error = expectInvalidParams("jenkins_create_job", {
      configXml: { leaked: "SECRET-XML-VALUE" },
    })
    expect(error.message).not.toContain("SECRET-XML-VALUE")

    const missing = expectInvalidParams("jenkins_replay_build", {
      buildNumber: 5,
      mainScript: "SECRET-SCRIPT-VALUE",
    })
    expect(missing.message).not.toContain("SECRET-SCRIPT-VALUE")
  })
})
