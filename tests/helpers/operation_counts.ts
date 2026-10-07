import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/** A counted operation with a first path argument. */
export type PathOperation =
  | "fs.statSync"
  | "fs.lstatSync"
  | "fs.existsSync"
  | "fs.readdirSync"
  | "fs.realpathSync"
  | "fs.realpathSync.native"
  | "path.relative"
  | "path.resolve";

/** One filesystem, path, or sort operation observed by the counter. */
export type Operation = PathOperation | "Array.prototype.sort";

/** Totals for every operation and first-argument counts for path operations. */
export interface OperationCounts {
  readonly totals: Readonly<Record<Operation, number>>;
  readonly byPath: Readonly<Record<PathOperation, ReadonlyMap<string, number>>>;
}

/** A callback's result and the operation counts recorded while it ran. */
export interface OperationCountResult<T> {
  readonly result: T;
  readonly counts: OperationCounts;
}

/** A once-per-run total, or a count for one operation's first path argument. */
export type OnceOnlyOperation =
  | { readonly operation: PathOperation; readonly path?: string }
  | { readonly operation: "Array.prototype.sort" };

const pathOperations: readonly PathOperation[] = [
  "fs.statSync",
  "fs.lstatSync",
  "fs.existsSync",
  "fs.readdirSync",
  "fs.realpathSync",
  "fs.realpathSync.native",
  "path.relative",
  "path.resolve",
];
let counting = false;

/** Count one synchronous callback; restore originals on every exit and reject thenables or nested use. */
export function countOperations<T>(callback: () => T): OperationCountResult<T> {
  if (counting) throw new Error("Nested operation counting is not supported");
  const originals = {
    stat: fs.statSync,
    lstat: fs.lstatSync,
    exists: fs.existsSync,
    readdir: fs.readdirSync,
    realpath: fs.realpathSync,
    native: fs.realpathSync.native,
    relative: path.relative,
    resolve: path.resolve,
    sort: Array.prototype.sort,
  };
  const totals = Object.fromEntries(
    [...pathOperations, "Array.prototype.sort"].map((operation) => [
      operation,
      0,
    ]),
  ) as Record<Operation, number>;
  const byPath = Object.fromEntries(
    pathOperations.map((operation) => [operation, new Map<string, number>()]),
  ) as Record<PathOperation, Map<string, number>>;
  const wrap = <F extends (...args: never[]) => unknown>(
    operation: Operation,
    original: F,
  ): F =>
    new Proxy(original, {
      apply(target, receiver, args) {
        totals[operation] += 1;
        if (operation !== "Array.prototype.sort") {
          const key = String(args[0]);
          const paths = byPath[operation];
          paths.set(key, (paths.get(key) ?? 0) + 1);
        }
        return Reflect.apply(target, receiver, args);
      },
    });
  counting = true;
  try {
    fs.statSync = wrap("fs.statSync", originals.stat);
    fs.lstatSync = wrap("fs.lstatSync", originals.lstat);
    fs.existsSync = wrap("fs.existsSync", originals.exists);
    fs.readdirSync = wrap("fs.readdirSync", originals.readdir);
    const native = wrap("fs.realpathSync.native", originals.native);
    fs.realpathSync = new Proxy(wrap("fs.realpathSync", originals.realpath), {
      get(target, property, receiver) {
        return property === "native"
          ? native
          : Reflect.get(target, property, receiver);
      },
    });
    path.relative = wrap("path.relative", originals.relative);
    path.resolve = wrap("path.resolve", originals.resolve);
    Array.prototype.sort = wrap("Array.prototype.sort", originals.sort);
    const result = callback();
    if (
      result !== null &&
      (typeof result === "object" || typeof result === "function") &&
      "then" in result &&
      typeof result.then === "function"
    ) {
      void Promise.resolve(result).catch(() => {});
      throw new Error(
        "Operation counting requires a synchronous callback; received a thenable",
      );
    }
    return { result, counts: { totals, byPath } };
  } finally {
    fs.statSync = originals.stat;
    fs.lstatSync = originals.lstat;
    fs.existsSync = originals.exists;
    fs.readdirSync = originals.readdir;
    fs.realpathSync = originals.realpath;
    fs.realpathSync.native = originals.native;
    path.relative = originals.relative;
    path.resolve = originals.resolve;
    Array.prototype.sort = originals.sort;
    counting = false;
  }
}

/** Check once-only counts and scaled totals at two input sizes. */
export function assertOperationScaling(
  smaller: OperationCountResult<unknown>,
  larger: OperationCountResult<unknown>,
  onceOnly: readonly OnceOnlyOperation[],
  scaledTotals: readonly Operation[],
): void {
  for (const selection of onceOnly) {
    const small = selectedCount(smaller.counts, selection);
    const large = selectedCount(larger.counts, selection);
    const selectedPath = "path" in selection ? selection.path : undefined;
    const name =
      selectedPath === undefined
        ? selection.operation
        : `${selection.operation} [${selectedPath}]`;
    const message = `${name}: smaller=${small}, larger=${large}`;
    assert.ok(
      small > 0,
      `${message}; the smaller count must be greater than zero`,
    );
    assert.equal(large, small, `${message}; once-only counts must be equal`);
  }
  for (const operation of scaledTotals) {
    const small = smaller.counts.totals[operation];
    const large = larger.counts.totals[operation];
    const message = `${operation}: smaller=${small}, larger=${large}`;
    assert.ok(
      small > 0,
      `${message}; the smaller total must be greater than zero`,
    );
    assert.ok(
      large <= small * 4.5,
      `${message}; the larger total must be at most 4.5 times the smaller total`,
    );
  }
}

function selectedCount(
  counts: OperationCounts,
  selection: OnceOnlyOperation,
): number {
  if (
    selection.operation === "Array.prototype.sort" ||
    selection.path === undefined
  )
    return counts.totals[selection.operation];
  return counts.byPath[selection.operation].get(selection.path) ?? 0;
}
