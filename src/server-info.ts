import { createRequire } from "node:module"

const packageJson = createRequire(import.meta.url)("../package.json") as {
  version: string
}

export const serverInfo = {
  name: "jenkins-mcp-server",
  version: packageJson.version,
}
