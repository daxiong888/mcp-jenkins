import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  loadToolFilter,
  loadAllJenkinsInstances,
  resolveJenkinsInstance,
} from "../../src/common/env.js"

describe("loadToolFilter", () => {
  afterEach(() => {
    delete process.env["MCP_JENKINS_ALLOW_TOOLS"]
    delete process.env["MCP_JENKINS_BLOCK_TOOLS"]
  })

  it("returns null allowlist and empty blocklist when no env vars set", () => {
    const filter = loadToolFilter()
    expect(filter.allowlist).toBeNull()
    expect(filter.blocklist).toEqual([])
  })

  it("parses MCP_JENKINS_ALLOW_TOOLS into allowlist", () => {
    process.env["MCP_JENKINS_ALLOW_TOOLS"] =
      "jenkins_list_jobs,jenkins_get_job_status"
    const filter = loadToolFilter()
    expect(filter.allowlist).toEqual([
      "jenkins_list_jobs",
      "jenkins_get_job_status",
    ])
    expect(filter.blocklist).toEqual([])
  })

  it("parses MCP_JENKINS_BLOCK_TOOLS into blocklist", () => {
    process.env["MCP_JENKINS_BLOCK_TOOLS"] =
      "jenkins_delete_job,jenkins_trigger_build"
    const filter = loadToolFilter()
    expect(filter.allowlist).toBeNull()
    expect(filter.blocklist).toEqual([
      "jenkins_delete_job",
      "jenkins_trigger_build",
    ])
  })

  it("returns both when both env vars are set — caller decides precedence", () => {
    process.env["MCP_JENKINS_ALLOW_TOOLS"] = "jenkins_list_jobs"
    process.env["MCP_JENKINS_BLOCK_TOOLS"] = "jenkins_delete_job"
    const filter = loadToolFilter()
    expect(filter.allowlist).toEqual(["jenkins_list_jobs"])
    expect(filter.blocklist).toEqual(["jenkins_delete_job"])
  })

  it("trims whitespace around tool names", () => {
    process.env["MCP_JENKINS_ALLOW_TOOLS"] =
      " jenkins_list_jobs , jenkins_get_job_status "
    const filter = loadToolFilter()
    expect(filter.allowlist).toEqual([
      "jenkins_list_jobs",
      "jenkins_get_job_status",
    ])
  })

  it("supports pipe as delimiter", () => {
    process.env["MCP_JENKINS_ALLOW_TOOLS"] =
      "jenkins_list_jobs|jenkins_get_job_status"
    const filter = loadToolFilter()
    expect(filter.allowlist).toEqual([
      "jenkins_list_jobs",
      "jenkins_get_job_status",
    ])
  })

  it("handles a single tool name", () => {
    process.env["MCP_JENKINS_ALLOW_TOOLS"] = "jenkins_list_jobs"
    const filter = loadToolFilter()
    expect(filter.allowlist).toEqual(["jenkins_list_jobs"])
  })
})

describe("loadAllJenkinsInstances — 2-tier priority", () => {
  const cleanEnv = () => {
    delete process.env["MCP_JENKINS_URL"]
    delete process.env["MCP_JENKINS_USER"]
    delete process.env["MCP_JENKINS_API_TOKEN"]
    delete process.env["MCP_JENKINS_BEARER_TOKEN"]
    delete process.env["MCP_JENKINS_ANONYMOUS"]
    delete process.env["MCP_JENKINS_INSTANCES"]
    delete process.env["JENKINS_URL"]
    delete process.env["JENKINS_USER"]
    delete process.env["JENKINS_API_TOKEN"]
  }

  beforeEach(cleanEnv)
  afterEach(cleanEnv)

  it("loads from MCP_JENKINS_* env vars", () => {
    process.env["MCP_JENKINS_URL"] = "https://jenkins.example.com"
    process.env["MCP_JENKINS_USER"] = "admin"
    process.env["MCP_JENKINS_API_TOKEN"] = "mytoken"

    const instances = loadAllJenkinsInstances({})
    const env = instances.values().next().value
    expect(env.JENKINS_URL).toBe("https://jenkins.example.com")
    expect(env.JENKINS_USER).toBe("admin")
    expect(env.JENKINS_API_TOKEN).toBe("mytoken")
  })

  it("CLI args take priority over MCP_JENKINS_* env vars", () => {
    process.env["MCP_JENKINS_URL"] = "https://from-env.example.com"
    process.env["MCP_JENKINS_USER"] = "env-user"
    process.env["MCP_JENKINS_API_TOKEN"] = "env-token"

    const instances = loadAllJenkinsInstances({
      jenkinsUrl: "https://from-cli.example.com",
      jenkinsUser: "cli-user",
      jenkinsApiToken: "cli-token",
    })
    const env = instances.values().next().value
    expect(env.JENKINS_URL).toBe("https://from-cli.example.com")
    expect(env.JENKINS_USER).toBe("cli-user")
    expect(env.JENKINS_API_TOKEN).toBe("cli-token")
  })

  it("does NOT pick up bare JENKINS_URL without MCP_ prefix", () => {
    process.env["JENKINS_URL"] = "https://bare-jenkins.example.com"
    process.env["JENKINS_USER"] = "bare-user"
    process.env["JENKINS_API_TOKEN"] = "bare-token"

    expect(() => loadAllJenkinsInstances({})).toThrow("Missing MCP_JENKINS_URL")
  })

  it("strips trailing slash from URL", () => {
    process.env["MCP_JENKINS_URL"] = "https://jenkins.example.com/"
    process.env["MCP_JENKINS_USER"] = "admin"
    process.env["MCP_JENKINS_API_TOKEN"] = "token"

    const instances = loadAllJenkinsInstances({})
    const env = instances.values().next().value
    expect(env.JENKINS_URL).toBe("https://jenkins.example.com")
  })

  it("throws when no URL is provided", () => {
    expect(() => loadAllJenkinsInstances({})).toThrow("Missing MCP_JENKINS_URL")
  })

  it("throws when URL is set but no auth is provided", () => {
    process.env["MCP_JENKINS_URL"] = "https://jenkins.example.com"

    let error: Error | undefined
    try {
      loadAllJenkinsInstances({})
    } catch (caught) {
      error = caught as Error
    }

    expect(error?.message).toContain("Missing Jenkins authentication")
    expect(error?.message).not.toContain("https://jenkins.example.com")
  })

  it("accepts bearer token auth without user/api-token", () => {
    process.env["MCP_JENKINS_URL"] = "https://jenkins.example.com"
    process.env["MCP_JENKINS_BEARER_TOKEN"] = "mybearer"

    const instances = loadAllJenkinsInstances({})
    const env = instances.values().next().value
    expect(env.JENKINS_BEARER_TOKEN).toBe("mybearer")
    expect(env.JENKINS_USER).toBeUndefined()
    expect(env.JENKINS_API_TOKEN).toBeUndefined()
  })

  it("derives instance name from URL hostname", () => {
    process.env["MCP_JENKINS_URL"] = "https://pipeline.yourcompany.com"
    process.env["MCP_JENKINS_USER"] = "admin"
    process.env["MCP_JENKINS_API_TOKEN"] = "token"

    const instances = loadAllJenkinsInstances({})
    expect(instances.has("pipeline")).toBe(true)
  })

  it("supports multiple instances via comma-separated values", () => {
    process.env["MCP_JENKINS_URL"] =
      "https://pipeline.example.com,https://scheduler.example.com"
    process.env["MCP_JENKINS_USER"] = "admin,admin"
    process.env["MCP_JENKINS_API_TOKEN"] = "token1,token2"

    const instances = loadAllJenkinsInstances({})
    expect(instances.size).toBe(2)
    expect(instances.has("pipeline")).toBe(true)
    expect(instances.has("scheduler")).toBe(true)
    expect(instances.get("scheduler")!.JENKINS_API_TOKEN).toBe("token2")
  })

  it("supports custom instance names via MCP_JENKINS_INSTANCES", () => {
    process.env["MCP_JENKINS_INSTANCES"] = "ci,prod"
    process.env["MCP_JENKINS_URL"] =
      "https://jenkins.example.com/ci,https://jenkins.example.com/prod"
    process.env["MCP_JENKINS_USER"] = "admin,admin"
    process.env["MCP_JENKINS_API_TOKEN"] = "token1,token2"

    const instances = loadAllJenkinsInstances({})
    expect(instances.has("ci")).toBe(true)
    expect(instances.has("prod")).toBe(true)
  })

  it("throws when instance count mismatches URL count", () => {
    process.env["MCP_JENKINS_INSTANCES"] = "ci,prod,staging"
    process.env["MCP_JENKINS_URL"] =
      "https://pipeline.example.com,https://scheduler.example.com"
    process.env["MCP_JENKINS_USER"] = "admin"
    process.env["MCP_JENKINS_API_TOKEN"] = "token"

    expect(() => loadAllJenkinsInstances({})).toThrow("counts must match")
  })

  it.each([
    ["MCP_JENKINS_USER", "admin"],
    ["MCP_JENKINS_API_TOKEN", "token1"],
    ["MCP_JENKINS_BEARER_TOKEN", "bearer1"],
  ])("throws when %s count mismatches URL count", (key, value) => {
    process.env["MCP_JENKINS_URL"] =
      "https://pipeline.example.com,https://scheduler.example.com"
    process.env["MCP_JENKINS_USER"] = "admin1,admin2"
    process.env["MCP_JENKINS_API_TOKEN"] = "token1,token2"
    process.env[key] = value

    expect(() => loadAllJenkinsInstances({})).toThrow(
      `${key} has 1 values but MCP_JENKINS_URL has 2 values`,
    )
  })

  it("anonymous single-instance accepts no user or token", () => {
    process.env["MCP_JENKINS_URL"] = "https://jenkins.example.com"
    process.env["MCP_JENKINS_ANONYMOUS"] = "true"

    const instances = loadAllJenkinsInstances({})
    const env = instances.values().next().value
    expect(env.JENKINS_ANONYMOUS).toBe(true)
    expect(env.JENKINS_USER).toBeUndefined()
    expect(env.JENKINS_API_TOKEN).toBeUndefined()
  })

  it("multi-instance positional anonymous flags apply per-instance", () => {
    process.env["MCP_JENKINS_URL"] =
      "https://pipeline.example.com,https://scheduler.example.com"
    process.env["MCP_JENKINS_ANONYMOUS"] = "true,false"
    process.env["MCP_JENKINS_USER"] = ",admin"
    process.env["MCP_JENKINS_API_TOKEN"] = ",token2"

    const instances = loadAllJenkinsInstances({})
    expect(instances.get("pipeline")!.JENKINS_ANONYMOUS).toBe(true)
    expect(instances.get("scheduler")!.JENKINS_ANONYMOUS).toBeUndefined()
  })

  it("cliArgs.jenkinsAnonymous takes precedence over MCP_JENKINS_ANONYMOUS env var", () => {
    process.env["MCP_JENKINS_URL"] = "https://jenkins.example.com"
    process.env["MCP_JENKINS_ANONYMOUS"] = "false"

    const instances = loadAllJenkinsInstances({ jenkinsAnonymous: true })
    const env = instances.values().next().value
    expect(env.JENKINS_ANONYMOUS).toBe(true)
  })
})

describe("resolveJenkinsInstance", () => {
  const instances = new Map([
    ["pipeline", { id: 1 }],
    ["scheduler", { id: 2 }],
  ])

  it("requires an explicit selector when multiple instances exist", () => {
    expect(() => resolveJenkinsInstance(instances)).toThrow(
      "instance is required when multiple Jenkins instances are configured",
    )
  })

  it("returns an explicitly selected instance", () => {
    expect(resolveJenkinsInstance(instances, "scheduler")).toEqual({ id: 2 })
  })

  it("allows omission when exactly one instance exists", () => {
    expect(
      resolveJenkinsInstance(new Map([["pipeline", { id: 1 }]])),
    ).toEqual({ id: 1 })
  })
})

describe("loadAllJenkinsInstances — URL and instance-name validation", () => {
  const cleanEnv = () => {
    delete process.env["MCP_JENKINS_URL"]
    delete process.env["MCP_JENKINS_USER"]
    delete process.env["MCP_JENKINS_API_TOKEN"]
    delete process.env["MCP_JENKINS_BEARER_TOKEN"]
    delete process.env["MCP_JENKINS_ANONYMOUS"]
    delete process.env["MCP_JENKINS_INSTANCES"]
  }

  beforeEach(cleanEnv)
  afterEach(cleanEnv)

  const withAuth = () => {
    process.env["MCP_JENKINS_USER"] = "admin"
    process.env["MCP_JENKINS_API_TOKEN"] = "token"
  }

  const loadError = (): Error => {
    try {
      loadAllJenkinsInstances({})
    } catch (caught) {
      return caught as Error
    }
    throw new Error("expected loadAllJenkinsInstances to throw")
  }

  it.each([
    "http://jenkins.example.com",
    "https://jenkins.example.com",
    "https://jenkins.example.com/ci",
    "https://jenkins.example.com/ci/",
  ])("accepts valid URL %s and keeps its context path", (url) => {
    process.env["MCP_JENKINS_URL"] = url
    withAuth()

    const env = loadAllJenkinsInstances({}).values().next().value
    expect(env.JENKINS_URL).toBe(url.replace(/\/$/, ""))
  })

  it("rejects an unparseable URL even with MCP_JENKINS_INSTANCES set", () => {
    process.env["MCP_JENKINS_INSTANCES"] = "ci"
    process.env["MCP_JENKINS_URL"] = "not-a-url"
    withAuth()

    expect(loadError().message).not.toContain("not-a-url")
  })

  it.each(["ftp://jenkins.example.com", "file:///etc/passwd"])(
    "rejects non-HTTP scheme %s",
    (url) => {
      process.env["MCP_JENKINS_URL"] = url
      withAuth()

      expect(() => loadAllJenkinsInstances({})).toThrow("http")
    },
  )

  it("rejects URLs with embedded credentials without echoing them", () => {
    process.env["MCP_JENKINS_URL"] = "https://ci-user:ci-pass@jenkins.example.com"
    withAuth()

    const message = loadError().message
    expect(message).toContain("credentials")
    expect(message).not.toContain("ci-user")
    expect(message).not.toContain("ci-pass")
    expect(message).not.toContain("jenkins.example.com")
  })

  it.each([
    "https://jenkins.example.com/?token=abc123",
    "https://jenkins.example.com/ci#fragment",
  ])("rejects URL with query or fragment: %s", (url) => {
    process.env["MCP_JENKINS_URL"] = url
    withAuth()

    expect(loadError().message).not.toContain(url)
  })

  it("rejects an empty instance name", () => {
    process.env["MCP_JENKINS_INSTANCES"] = ",ci"
    process.env["MCP_JENKINS_URL"] =
      "https://one.example.com,https://two.example.com"
    process.env["MCP_JENKINS_USER"] = "admin,admin"
    process.env["MCP_JENKINS_API_TOKEN"] = "t1,t2"

    expect(() => loadAllJenkinsInstances({})).toThrow("instance name")
  })

  it("rejects illegal instance names without echoing them", () => {
    process.env["MCP_JENKINS_INSTANCES"] = "bad name!"
    process.env["MCP_JENKINS_URL"] = "https://jenkins.example.com"
    withAuth()

    const message = loadError().message
    expect(message).toContain("instance name")
    expect(message).not.toContain("bad name!")
  })

  it("rejects duplicate instance names", () => {
    process.env["MCP_JENKINS_INSTANCES"] = "ci,ci"
    process.env["MCP_JENKINS_URL"] =
      "https://one.example.com,https://two.example.com"
    process.env["MCP_JENKINS_USER"] = "admin,admin"
    process.env["MCP_JENKINS_API_TOKEN"] = "t1,t2"

    expect(() => loadAllJenkinsInstances({})).toThrow("unique")
  })

  it("accepts conservative custom instance names", () => {
    process.env["MCP_JENKINS_INSTANCES"] = "ci-2.prod_x"
    process.env["MCP_JENKINS_URL"] = "https://jenkins.example.com"
    withAuth()

    expect(loadAllJenkinsInstances({}).has("ci-2.prod_x")).toBe(true)
  })
})
