import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { errorResponse } from "./errors.js"
import { logger } from "./logger.js"

type ToolHandler = (client: any, input: any) => Promise<unknown>

export const invokeToolHandler = async (
  toolName: string,
  handler: ToolHandler,
  client: any,
  input: any,
): Promise<CallToolResult> => {
  try {
    const result = await handler(client, input)
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    }
  } catch (error: any) {
    logger.error("Tool execution failed", {
      tool: toolName,
      code: error?.code,
      status: error?.status,
    })
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify(errorResponse(error), null, 2),
        },
      ],
    }
  }
}
