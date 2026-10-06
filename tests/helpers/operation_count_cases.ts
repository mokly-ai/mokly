import type {
  Operation,
  OnceOnlyOperation,
  PathOperation,
} from "./operation_counts.js";

interface LoopCounts {
  readonly fixed: number;
  readonly scaled: number;
}

interface OperationScalingFailure {
  readonly name: string;
  readonly operation: PathOperation;
  readonly path?: string;
  readonly smaller: number;
  readonly larger: number;
  readonly smallerInput: LoopCounts;
  readonly largerInput: LoopCounts;
  readonly onceOnly: readonly OnceOnlyOperation[];
  readonly scaledTotals: readonly Operation[];
}

/** Failure cases for the two-size count assertions, including missed paths. */
export function operationScalingFailures(directory: string) {
  const failures: OperationScalingFailure[] = [
    {
      name: "growing once-only total",
      operation: "path.resolve",
      smaller: 2,
      larger: 3,
      smallerInput: { fixed: 2, scaled: 1 },
      largerInput: { fixed: 3, scaled: 1 },
      onceOnly: [{ operation: "path.resolve" }],
      scaledTotals: [],
    },
    {
      name: "decreasing once-only total",
      operation: "path.resolve",
      smaller: 2,
      larger: 1,
      smallerInput: { fixed: 2, scaled: 1 },
      largerInput: { fixed: 1, scaled: 1 },
      onceOnly: [{ operation: "path.resolve" }],
      scaledTotals: [],
    },
    {
      name: "growing once-only path count",
      operation: "path.resolve",
      path: directory,
      smaller: 2,
      larger: 3,
      smallerInput: { fixed: 2, scaled: 1 },
      largerInput: { fixed: 3, scaled: 1 },
      onceOnly: [{ operation: "path.resolve", path: directory }],
      scaledTotals: [],
    },
    {
      name: "decreasing once-only path count",
      operation: "path.resolve",
      path: directory,
      smaller: 2,
      larger: 1,
      smallerInput: { fixed: 2, scaled: 1 },
      largerInput: { fixed: 1, scaled: 1 },
      onceOnly: [{ operation: "path.resolve", path: directory }],
      scaledTotals: [],
    },
    {
      name: "zero once-only total",
      operation: "path.resolve",
      smaller: 0,
      larger: 0,
      smallerInput: { fixed: 0, scaled: 1 },
      largerInput: { fixed: 0, scaled: 1 },
      onceOnly: [{ operation: "path.resolve" }],
      scaledTotals: [],
    },
    {
      name: "zero once-only path count",
      operation: "path.resolve",
      path: directory,
      smaller: 0,
      larger: 0,
      smallerInput: { fixed: 0, scaled: 1 },
      largerInput: { fixed: 0, scaled: 1 },
      onceOnly: [{ operation: "path.resolve", path: directory }],
      scaledTotals: [],
    },
    {
      name: "zero total before growth",
      operation: "path.resolve",
      smaller: 0,
      larger: 1,
      smallerInput: { fixed: 0, scaled: 1 },
      largerInput: { fixed: 1, scaled: 1 },
      onceOnly: [{ operation: "path.resolve" }],
      scaledTotals: [],
    },
    {
      name: "zero path count before growth",
      operation: "path.resolve",
      path: directory,
      smaller: 0,
      larger: 1,
      smallerInput: { fixed: 0, scaled: 1 },
      largerInput: { fixed: 1, scaled: 1 },
      onceOnly: [{ operation: "path.resolve", path: directory }],
      scaledTotals: [],
    },
    {
      name: "unintercepted path",
      operation: "path.resolve",
      path: "absent",
      smaller: 0,
      larger: 0,
      smallerInput: { fixed: 1, scaled: 1 },
      largerInput: { fixed: 1, scaled: 1 },
      onceOnly: [{ operation: "path.resolve", path: "absent" }],
      scaledTotals: [],
    },
    {
      name: "total above the 4.5 ratio",
      operation: "fs.existsSync",
      smaller: 2,
      larger: 10,
      smallerInput: { fixed: 1, scaled: 2 },
      largerInput: { fixed: 1, scaled: 10 },
      onceOnly: [],
      scaledTotals: ["fs.existsSync"],
    },
    {
      name: "zero scaled total",
      operation: "fs.existsSync",
      smaller: 0,
      larger: 0,
      smallerInput: { fixed: 1, scaled: 0 },
      largerInput: { fixed: 1, scaled: 0 },
      onceOnly: [],
      scaledTotals: ["fs.existsSync"],
    },
    {
      name: "zero scaled total before growth",
      operation: "fs.existsSync",
      smaller: 0,
      larger: 1,
      smallerInput: { fixed: 1, scaled: 0 },
      largerInput: { fixed: 1, scaled: 1 },
      onceOnly: [],
      scaledTotals: ["fs.existsSync"],
    },
  ];

  return failures;
}

/** Promise and thenable results that must not escape a counting window. */
export const asynchronousResults = [
  { name: "fulfilled promise", create: () => Promise.resolve("result") },
  { name: "pending promise", create: () => new Promise(() => {}) },
  {
    name: "rejected promise",
    create: () => Promise.reject(new Error("rejected")),
  },
  {
    name: "custom thenable",
    create: () => ({
      then(
        _resolve: (value: unknown) => void,
        reject: (error: unknown) => void,
      ) {
        reject(new Error("thenable rejected"));
      },
    }),
  },
  {
    name: "function thenable",
    create: () =>
      Object.assign(() => {}, {
        then(
          _resolve: (value: unknown) => void,
          reject: (error: unknown) => void,
        ) {
          reject(new Error("function thenable rejected"));
        },
      }),
  },
];
