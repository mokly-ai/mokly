import path from "node:path";
import { fileURLToPath } from "node:url";
import { types } from "node:util";

type ReadOptions = { raw: unknown; encoding?: BufferEncoding };

/** Exotic options and handles keep native behaviour and incomplete coverage. */
export function options(value: unknown): ReadOptions | undefined {
  if (value === null || value === undefined) return { raw: value };
  if (typeof value === "string")
    return Buffer.isEncoding(value)
      ? { raw: null, encoding: value }
      : undefined;
  if (typeof value !== "object" || types.isProxy(value)) return undefined;
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    return undefined;
  const fields = Object.getOwnPropertyDescriptors(value);
  if (
    Object.values(fields).some((field) => field.get || field.set) ||
    fields.buffer
  )
    return undefined;
  const encoding: unknown = fields.encoding?.value;
  if (
    encoding !== undefined &&
    encoding !== null &&
    (typeof encoding !== "string" || !Buffer.isEncoding(encoding))
  )
    return undefined;
  fields.encoding = { ...fields.encoding, value: null };
  return {
    raw: Object.create(Object.getPrototypeOf(value), fields),
    ...(typeof encoding === "string" && Buffer.isEncoding(encoding)
      ? { encoding }
      : {}),
  };
}

export function filename(value: unknown): string | undefined {
  if (types.isProxy(value)) return undefined;
  if (typeof value === "string") return path.resolve(value);
  if (value instanceof URL && value.protocol === "file:") {
    try {
      return fileURLToPath(value);
    } catch {
      return undefined;
    }
  }
  if (Buffer.isBuffer(value)) {
    const text = value.toString();
    if (Buffer.from(text).equals(value)) return path.resolve(text);
  }
  return undefined;
}
