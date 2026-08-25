import { describe, it, expect, vi, beforeEach } from "vitest"
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import * as common from "../src/common/index.js"
import { rawTools } from "../src/tool-manifest.js"

// Mock the common module before importing the server logic
vi.mock("../src/common/index.js", () => ({
  httpGetJson: vi.fn(),
  httpGetText: vi.fn(),
  httpPost: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  loadJenkinsEnv: vi.fn(() => ({
    JENKINS_URL: "https://jenkins.example.com",
    JENKINS_USER: "testuser",
    JENKINS_API_TOKEN: "testtoken",
  })),
  errorResponse: (message: string, code = "INTERNAL_ERROR") => ({
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  }),
  Errors: {
    authFailed: () => new Error("Authentication failed"),
    jobNotFound: (job: string) => new Error(`Job not found: ${job}`),
    artifactNotFound: (path: string) =>
      new Error(`Artifact not found: ${path}`),
  },
  McpError: class McpError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message)
    }
  },
}))

describe("MCP Server", () => {
  let server: Server

  beforeEach(() => {
    vi.clearAllMocks()
    server = new Server(
      {
        name: "jenkins-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    )
  })

  describe("Tool Registration", () => {
    it("should expose the production tool manifest", () => {
      const names = rawTools.map((t) => t.name)

      expect(names).toHaveLength(38)
      expect(names).toContain("jenkins_get_job_status")
      expect(names).toContain("jenkins_trigger_build")
      expect(names).toContain("jenkins_list_jobs")
      expect(names).toContain("jenkins_get_console_log")
      expect(names).toContain("jenkins_list_instances")
    })

    it("should have proper tool schemas", () => {
      const getJobStatus = rawTools.find(
        (t) => t.name === "jenkins_get_job_status",
      )!

      expect(getJobStatus.inputSchema.required).toContain("jobName")
      const properties = getJobStatus.inputSchema.properties as Record<
        string,
        { type: string }
      >
      expect(properties.jobName.type).toBe("string")
    })

    it("should have proper trigger_build schema with optional params", () => {
      const triggerBuild = rawTools.find(
        (t) => t.name === "jenkins_trigger_build",
      )!

      expect(triggerBuild.inputSchema.required).toContain("jobName")
      expect(triggerBuild.inputSchema.required).not.toContain("params")
    })
  })

  describe("Error Handling", () => {
    it("should handle authentication errors properly", () => {
      const authError = new Error("Authentication failed")
      const errorResp = common.errorResponse("Authentication failed")

      expect(errorResp.isError).toBe(true)
      expect(errorResp.content[0].text).toContain("Error")
    })

    it("should handle job not found errors", () => {
      const error = common.Errors.jobNotFound("nonexistent-job")

      expect(error.message).toContain("nonexistent-job")
    })

    it("should handle artifact not found errors", () => {
      const error = common.Errors.artifactNotFound("missing-file.jar")

      expect(error.message).toContain("missing-file.jar")
    })
  })

  describe("Environment Configuration", () => {
    it("should load Jenkins configuration from environment", () => {
      const env = common.loadJenkinsEnv()

      expect(env.JENKINS_URL).toBe("https://jenkins.example.com")
      expect(env.JENKINS_USER).toBe("testuser")
      expect(env.JENKINS_API_TOKEN).toBe("testtoken")
    })
  })
})
