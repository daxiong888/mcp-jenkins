interface LogFields {
  [k: string]: any
}

const sensitiveKeys = new Set([
  "authorization",
  "baseurl",
  "bearertoken",
  "body",
  "cookie",
  "credentials",
  "error",
  "headers",
  "password",
  "response",
  "responsebody",
  "setcookie",
  "token",
  "apitoken",
  "url",
  "user",
  "username",
])

const sanitizeString = (value: string): string =>
  value
    .replace(/\bhttps?:\/\/[^\s"'<>]+/gi, "[REDACTED_URL]")
    .replace(/\b(?:Basic|Bearer)\s+\S+/gi, "[REDACTED_AUTH]")

const sanitizeValue = (value: any): any => {
  if (typeof value === "string") return sanitizeString(value)
  if (Array.isArray(value)) return value.map(sanitizeValue)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => {
        const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase()
        return [
          key,
          sensitiveKeys.has(normalizedKey)
            ? "[REDACTED]"
            : sanitizeValue(nested),
        ]
      }),
    )
  }
  return value
}

const base = (level: string, msg: string, fields?: LogFields) => {
  const entry: any = {
    level,
    msg: sanitizeString(msg),
    time: new Date().toISOString(),
  }
  if (fields) entry.fields = sanitizeValue(fields)
  // eslint-disable-next-line no-console
  console.error(JSON.stringify(entry))
}

export const logger = {
  info: (msg: string, f?: LogFields) => base("info", msg, f),
  warn: (msg: string, f?: LogFields) => base("warn", msg, f),
  error: (msg: string, f?: LogFields) => base("error", msg, f),
}
