import { AjvJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/ajv"
import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import { McpError } from "./errors.js"

/**
 * Compiles one AJV validator per tool from its advertised inputSchema and
 * caches it for the process lifetime. Failure messages come from AJV's
 * errorsText, which reports property names and expectations only — argument
 * values (configXml, mainScript, credentials) are never echoed.
 */
export const buildInputValidators = (
  tools: readonly Tool[],
): Map<string, (args: unknown) => void> => {
  const provider = new AjvJsonSchemaValidator()
  const validators = new Map<string, (args: unknown) => void>()
  for (const tool of tools) {
    const validate = provider.getValidator(tool.inputSchema as never)
    validators.set(tool.name, (args: unknown) => {
      const result = validate(args ?? {})
      if (!result.valid) {
        throw new McpError(
          "INVALID_PARAMS",
          `Invalid arguments for ${tool.name}: ${result.errorMessage}`,
          400,
        )
      }
    })
  }
  return validators
}
