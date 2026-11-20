/** Observe the real sidecar's first rejected capture without adding filesystem probes. */
import { CaptureDurability } from "../../../../packages/mokly/dist/sidecar/capture-durability.js";
import {
  captureRuntime,
  mature,
} from "../../../../packages/mokly/dist/sidecar/capture-runtime.js";
import { CaptureVolumes } from "../../../../packages/mokly/dist/sidecar/capture-volumes.js";

/** @typedef {import("../../../../packages/mokly/dist/sidecar/capture-runtime.js").CaptureStat} CaptureStat */
/** @typedef {{file: string, follow: boolean, stat: CaptureStat, metadata: boolean}} Witness */
/** @typedef {{durable: boolean, witnesses: Map<string, Witness>}} Capture */
/** @typedef {{method: string, args: unknown[], value?: unknown, error?: string}} Read */
/** @typedef {{capture: Capture, method: string, args: unknown[], reads: Read[], witness?: Witness, volume?: Read}} Context */
/** @type {Context[]} */
const active = [];
/** @type {WeakMap<Capture, {root?: string, rejected: boolean}>} */
const captures = new WeakMap();

/** @param {Capture} capture */
function information(capture) {
  let info = captures.get(capture);
  if (!info) {
    info = { rejected: false };
    captures.set(capture, info);
  }
  return info;
}

/** @param {unknown} value @returns {value is CaptureStat} */
function isStat(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    ["dev", "ino", "ctimeNs", "mtimeNs", "size"].every(
      (key) => typeof Reflect.get(value, key) === "bigint",
    ) &&
    ["isDirectory", "isFile", "isSymbolicLink"].every(
      (key) => typeof Reflect.get(value, key) === "function",
    )
  );
}

/** @param {Context} context */
function rejected(context) {
  const info = information(context.capture);
  if (info.rejected) return;
  info.rejected = true;
  try {
    const stat = context.args[1];
    const touched = context.reads.findLast(
      (read) => read.method === "now",
    )?.value;
    const reason = context.volume
      ? "unsupported-volume"
      : context.reads.some((read) => read.error)
        ? "runtime-error"
        : `${context.method}-rejected`;
    process.stderr.write(
      `[mokly/test-capture-rejection] ${JSON.stringify(
        {
          pid: process.pid,
          source: info.root,
          reason,
          method: context.method,
          arguments: context.args,
          witness: context.witness,
          reads: context.reads,
          volume: context.volume,
          observedMature:
            context.method === "observe" &&
            isStat(stat) &&
            typeof touched === "bigint"
              ? mature(stat, touched)
              : undefined,
        },
        (_key, value) => (typeof value === "bigint" ? value.toString() : value),
      )}\n`,
    );
  } catch {
    return;
  }
}

/** @param {Read} read */
function observation(read) {
  try {
    const context = active.at(-1);
    if (!context) return;
    const file = read.args[0];
    if (
      context.method === "finish" &&
      typeof file === "string" &&
      (read.method === "stat" || read.method === "lstat")
    ) {
      const witness = context.capture.witnesses.get(
        JSON.stringify([file, read.method === "stat"]),
      );
      if (witness && witness !== context.witness) {
        context.witness = witness;
        context.reads = [];
      }
    }
    context.reads.push(read);
  } catch {
    return;
  }
}

for (const method of ["now", "lstat", "stat", "handleStat", "filesystem"]) {
  const original = Reflect.get(captureRuntime, method);
  Object.defineProperty(captureRuntime, method, {
    value(...args) {
      try {
        const value = original.apply(this, args);
        observation({ method, args, value });
        return value;
      } catch (error) {
        observation({ method, args, error: String(error) });
        throw error;
      }
    },
  });
}

const supported = CaptureVolumes.prototype.supported;
Object.defineProperty(CaptureVolumes.prototype, "supported", {
  value(...args) {
    const value = supported.apply(this, args);
    const context = active.at(-1);
    if (context && !value)
      context.volume = { method: "supported", args, value };
    return value;
  },
});

const prepare = CaptureDurability.prototype.prepare;
Object.defineProperty(CaptureDurability.prototype, "prepare", {
  /** @this {Capture} */
  value(...args) {
    const params = args[0];
    if (params && typeof params.sourceRoot === "string")
      information(this).root = params.sourceRoot;
    if (!this.durable)
      rejected({ capture: this, method: "prepare", args, reads: [] });
    return prepare.apply(this, args);
  },
});

for (const method of [
  "preflight",
  "budget",
  "path",
  "target",
  "observe",
  "finish",
]) {
  const original = Reflect.get(CaptureDurability.prototype, method);
  Object.defineProperty(CaptureDurability.prototype, method, {
    /** @this {Capture} */
    value(...args) {
      const wasDurable = this.durable;
      const context = { capture: this, method, args, reads: [] };
      active.push(context);
      try {
        const value = original.apply(this, args);
        if ((wasDurable && !this.durable) || (method === "finish" && !value))
          rejected(context);
        return value;
      } finally {
        active.pop();
      }
    },
  });
}

await import("../../../../packages/mokly/dist/sidecar.js");
