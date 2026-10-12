import type { MaterialRecipe } from "../../dist/components/material_recipe.js";

/** Observe every search/read while guards run; indexing must finish before this scope. */
export function observeFingerprintReads(
  source: string,
  recipe: MaterialRecipe,
  run: () => unknown,
) {
  const edges = recipe.flatMap((piece) =>
    piece.kind === "source"
      ? ([
          [piece.start, Math.min(piece.end, piece.start + 12)],
          [Math.max(piece.start, piece.end - 12), piece.end],
        ] as const)
      : [],
  );
  const violations: string[] = [];
  let calls = 0;
  const restores: (() => void)[] = [];
  const observe = (
    method: string,
    value: string,
    start: number,
    end: number,
  ) => {
    calls++;
    if (
      (end - start > 24 ||
        (value === source &&
          !edges.some(([low, high]) => low <= start && end <= high))) &&
      violations.length < 20
    )
      violations.push(`${method}: ${start}..${end} of ${value.length}`);
  };
  const patch = (
    target: object,
    name: string,
    inspect: (self: unknown, args: unknown[]) => void,
  ) => {
    const descriptor = Object.getOwnPropertyDescriptor(target, name)!;
    const original = descriptor.value as (...args: unknown[]) => unknown;
    Object.defineProperty(target, name, {
      ...descriptor,
      value: function (this: unknown, ...args: unknown[]) {
        inspect(this, args);
        return Reflect.apply(original, this, args);
      },
    });
    restores.push(() => Object.defineProperty(target, name, descriptor));
  };
  for (const name of [
    "slice",
    "substring",
    "substr",
    "indexOf",
    "lastIndexOf",
    "includes",
    "startsWith",
    "endsWith",
    "search",
    "match",
    "matchAll",
    "replace",
    "replaceAll",
    "split",
    "toLowerCase",
  ]) {
    patch(String.prototype, name, (self, args) => {
      const value = String(self);
      const [start, end] = readRange(name, value.length, args);
      observe(name, value, start, end);
    });
  }
  for (const name of ["exec", "test"])
    patch(RegExp.prototype, name, (_self, args) => {
      const value = String(args[0]);
      observe(`RegExp.${name}`, value, 0, value.length);
    });
  try {
    run();
  } finally {
    for (const restore of restores) restore();
  }
  return { calls, violations };
}

function readRange(
  name: string,
  length: number,
  args: unknown[],
): [number, number] {
  const clamp = (value: unknown, fallback: number) =>
    value === undefined
      ? fallback
      : Math.min(length, Math.max(0, Number(value)));
  const relative = (value: unknown, fallback: number) =>
    value === undefined
      ? fallback
      : Number(value) < 0
        ? Math.max(0, length + Number(value))
        : clamp(value, fallback);
  if (name === "slice") {
    const start = relative(args[0], 0);
    return [start, Math.max(start, relative(args[1], length))];
  }
  if (name === "substring") {
    const a = clamp(args[0], 0),
      b = clamp(args[1], length);
    return [Math.min(a, b), Math.max(a, b)];
  }
  if (name === "substr") {
    const start = relative(args[0], 0);
    return [start, Math.min(length, start + clamp(args[1], length))];
  }
  if (name === "startsWith") {
    const start = clamp(args[1], 0);
    return [start, Math.min(length, start + String(args[0]).length)];
  }
  if (name === "endsWith") {
    const end = clamp(args[1], length);
    return [Math.max(0, end - String(args[0]).length), end];
  }
  if (name === "indexOf" || name === "includes")
    return [clamp(args[1], 0), length];
  if (name === "lastIndexOf")
    return [
      0,
      Math.min(length, clamp(args[1], length) + String(args[0]).length),
    ];
  return [0, length];
}
