import { types } from "node:util";

type ReadArguments = {
  offset: number;
  position: unknown;
  length: number | undefined;
};

/** Accessors and proxies retain native evaluation and supply no guessed offsets. */
function fields(value: unknown): Record<string, unknown> | undefined {
  if (value === null || value === undefined) return {};
  if (typeof value !== "object" || types.isProxy(value)) return;
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) return;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.values(descriptors).some((field) => field.get || field.set))
    return;
  return Object.fromEntries(
    Object.entries(descriptors).map(([name, field]) => [name, field.value]),
  );
}

/** Normalize only observation metadata; Node still receives and validates original arguments. */
export function readArguments(args: unknown[]): ReadArguments | undefined {
  let options: Record<string, unknown> | undefined;
  let defaultLength = true;
  if (ArrayBuffer.isView(args[0])) {
    if (args[1] === null && args.length > 2) return;
    if (
      typeof args[1] === "number" ||
      (args[1] === undefined && args.length > 2)
    ) {
      options = { offset: args[1], length: args[2], position: args[3] };
      defaultLength = false;
    } else options = fields(args[1]);
  } else options = fields(args[0]);
  if (!options) return;
  const offset = options.offset ?? 0;
  if (typeof offset !== "number" || !Number.isSafeInteger(offset) || offset < 0)
    return;
  const buffer = ArrayBuffer.isView(args[0]) ? args[0] : options.buffer;
  const length =
    typeof options.length === "number"
      ? options.length
      : options.length === undefined && defaultLength
        ? (ArrayBuffer.isView(buffer) ? buffer.byteLength : 16384) - offset
        : undefined;
  return { offset, position: options.position, length };
}

export function delivered(
  buffer: unknown,
  offset: number,
  count: unknown,
): Uint8Array | undefined {
  if (!ArrayBuffer.isView(buffer) || typeof count !== "number" || count < 0)
    return;
  if (offset + count > buffer.byteLength) return;
  return new Uint8Array(buffer.buffer, buffer.byteOffset + offset, count);
}

export function vectorBytes(
  buffers: unknown,
  count: unknown,
): Uint8Array | undefined {
  if (!Array.isArray(buffers) || typeof count !== "number" || count < 0) return;
  const chunks: Uint8Array[] = [];
  let remaining = count;
  for (const buffer of buffers) {
    if (!ArrayBuffer.isView(buffer)) return;
    const length = Math.min(buffer.byteLength, remaining);
    chunks.push(new Uint8Array(buffer.buffer, buffer.byteOffset, length));
    remaining -= length;
    if (!remaining) break;
  }
  return remaining ? undefined : Buffer.concat(chunks);
}

/** Retain actual submitted buffers when callers later replace array elements. */
export function vectorInputs(value: unknown): ArrayBufferView[] | undefined {
  if (
    !Array.isArray(value) ||
    types.isProxy(value) ||
    Object.getPrototypeOf(value) !== Array.prototype
  )
    return;
  const result: ArrayBufferView[] = [];
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    const buffer: unknown = descriptor?.value;
    if (!ArrayBuffer.isView(buffer)) return;
    result.push(buffer);
  }
  return result;
}
