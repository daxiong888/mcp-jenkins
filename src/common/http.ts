import { Errors } from './errors.js';

export interface HttpClientOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
}

// Shared status mapping: 2xx succeeds, 401/403 get dedicated errors, any other
// non-2xx fails with the status only — never the URL, credentials, or body.
const throwForStatus = (res: Response): void => {
  if (res.status === 401) throw Errors.authFailed();
  if (res.status === 403) throw Errors.permissionDenied();
  if (!res.ok) throw Errors.httpFailed(res.status);
};

export const httpGetJson = async <T>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), init.timeoutMs ?? 10000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    throwForStatus(res);
    return await res.json() as T;
  } catch (e: any) {
    if (e.name === 'AbortError') throw Errors.timeout();
    throw e;
  } finally {
    clearTimeout(t);
  }
};

export const httpGetText = async (url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<string> => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), init.timeoutMs ?? 10000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    throwForStatus(res);
    return await res.text();
  } catch (e: any) {
    if (e.name === 'AbortError') throw Errors.timeout();
    throw e;
  } finally {
    clearTimeout(t);
  }
};

export interface HttpTextChunk {
  text: string;
  byteLength: number;
  truncated: boolean;
  headers: Record<string, string | null>;
}

// Read at most maxBytes of decoded UTF-8 text without buffering an unbounded
// response. Up to four look-ahead bytes are retained only to detect truncation
// and avoid ending the returned cursor in the middle of a UTF-8 code point.
export const httpGetTextChunk = async (
  url: string,
  maxBytes: number,
  init: RequestInit & { timeoutMs?: number } = {},
  startByte = 0,
): Promise<HttpTextChunk> => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), init.timeoutMs ?? 10000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    throwForStatus(res);
    const headers = Object.fromEntries(res.headers.entries());
    const reader = res.body?.getReader();

    if (!reader) {
      return {
        text: "",
        byteLength: 0,
        truncated: false,
        headers,
      };
    }

    const chunks: Buffer[] = [];
    const readLimit = maxBytes + 4;
    let skipped = 0;
    let collected = 0;
    let done = false;
    let truncated = false;

    while (!done && collected < readLimit) {
      const next = await reader.read();
      done = next.done;
      if (done || !next.value) break;

      let chunkOffset = 0;
      if (skipped < startByte) {
        const skipLength = Math.min(
          next.value.byteLength,
          startByte - skipped,
        );
        skipped += skipLength;
        chunkOffset = skipLength;
      }
      if (chunkOffset === next.value.byteLength) continue;

      const remaining = readLimit - collected;
      const available = next.value.byteLength - chunkOffset;
      const take = Math.min(available, remaining);
      chunks.push(
        Buffer.from(
          next.value.buffer,
          next.value.byteOffset + chunkOffset,
          take,
        ),
      );
      collected += take;
      if (take < available || collected >= readLimit) {
        truncated = true;
        break;
      }
    }

    if (skipped < startByte) {
      throw Errors.invalidInput("Console log cursor is past current output");
    }
    if (truncated) await reader.cancel();

    const raw = Buffer.concat(chunks, collected);
    let byteLength = Math.min(raw.length, maxBytes);
    let text: string | undefined;
    for (let trim = 0; trim <= 3 && byteLength - trim >= 0; trim += 1) {
      try {
        const candidateLength = byteLength - trim;
        text = new TextDecoder("utf-8", { fatal: true }).decode(
          raw.subarray(0, candidateLength),
        );
        byteLength = candidateLength;
        break;
      } catch {
        // A valid UTF-8 code point is at most four bytes, so only the trailing
        // boundary can require adjustment for Jenkins' UTF-8 console output.
      }
    }
    if (text === undefined) {
      text = raw.subarray(0, byteLength).toString("utf8");
    }

    return {
      text,
      byteLength,
      truncated: truncated || raw.length > byteLength,
      headers,
    };
  } catch (e: any) {
    if (e.name === "AbortError") throw Errors.timeout();
    throw e;
  } finally {
    clearTimeout(t);
  }
};

export const httpPost = async (url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<{ status: number; headers: Record<string, string | null> }> => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), init.timeoutMs ?? 10000);
  try {
    const res = await fetch(url, { method: 'POST', ...init, signal: controller.signal });
    if (res.status === 401) throw Errors.authFailed();
    if (res.status === 403) throw Errors.permissionDenied();
    if (!res.ok) throw Errors.httpFailed(res.status);
    return { status: res.status, headers: Object.fromEntries(res.headers.entries()) };
  } catch (e: any) {
    if (e.name === 'AbortError') throw Errors.timeout();
    throw e;
  } finally { clearTimeout(t); }
};

export const httpGetBuffer = async (url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Buffer> => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), init.timeoutMs ?? 10000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    throwForStatus(res);
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch (e: any) {
    if (e.name === 'AbortError') throw Errors.timeout();
    throw e;
  } finally { clearTimeout(t); }
};

export const httpHead = async (url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<{ status: number; headers: Record<string, string | null> }> => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), init.timeoutMs ?? 10000);
  try {
    const res = await fetch(url, { method: 'HEAD', ...init, signal: controller.signal });
    throwForStatus(res);
    return { status: res.status, headers: Object.fromEntries(res.headers.entries()) };
  } catch (e: any) {
    if (e.name === 'AbortError') throw Errors.timeout();
    throw e;
  } finally { clearTimeout(t); }
};
