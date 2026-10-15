import { protocol } from "./errors.js";

const ids = new WeakMap<object, string>();
const parsedFrames = new WeakSet<object>();

/** Keep opaque u64 ids exact while ordinary JSON data uses JavaScript numbers. */
export function captureRequestId(json: string, value: unknown): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  parsedFrames.add(value);
  let depth = 0;
  let keyExpected = false;
  const keys = new Set<string>();
  for (let offset = 0; offset < json.length; offset++) {
    const char = json[offset];
    if (char === '"') {
      const start = offset;
      while (++offset < json.length) {
        if (json[offset] === "\\") offset++;
        else if (json[offset] === '"') break;
      }
      if (depth === 1 && keyExpected) {
        const key = JSON.parse(json.slice(start, offset + 1)) as string;
        if (keys.has(key)) protocol(`duplicate request field ${key}`);
        keys.add(key);
        keyExpected = false;
        if (key === "id") {
          const rest = json.slice(offset + 1);
          const match = /^\s*:\s*(\d+)(?=\s*[,}])/.exec(rest);
          if (match && BigInt(match[1]!) <= 18_446_744_073_709_551_615n)
            ids.set(value, match[1]!);
        }
      }
    } else if (char === "{" || char === "[") {
      depth++;
      if (depth === 1) keyExpected = char === "{";
    } else if (char === "}" || char === "]") depth--;
    else if (char === "," && depth === 1) keyExpected = true;
  }
}

export function requestId(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return;
  const raw = ids.get(value);
  if (raw) return raw;
  if (parsedFrames.has(value)) return;
  if ("id" in value && Number.isSafeInteger(value.id) && Number(value.id) >= 0)
    return String(value.id);
}
