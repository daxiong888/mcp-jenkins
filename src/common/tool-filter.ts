import { McpError } from "./errors.js"

/** Names of tools exposed to callers after allow/block filtering. */
export const exposedToolNames = (
  tools: readonly { name: string }[],
): ReadonlySet<string> => new Set(tools.map((t) => t.name))

/**
 * Fail closed at call time: a name outside the exposed set is rejected as an
 * unknown tool, indistinguishable from a tool that does not exist — the error
 * must not reveal that the tool was merely filtered out.
 */
export const assertToolExposed = (
  exposed: ReadonlySet<string>,
  name: string,
): void => {
  if (!exposed.has(name)) {
    throw new McpError("TOOL_NOT_FOUND", `Unknown tool: ${name}`, 404)
  }
}
