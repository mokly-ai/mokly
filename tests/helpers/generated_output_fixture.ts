import fs from "node:fs/promises";
import path from "node:path";

/** Entry source that registers `count` screens whose bodies show `label`. */
export function screensSource(count: number, label: string): string {
  return `import { defineScreen } from "@mokly/mokly";
import React from "react";
export const mockups = Array.from({ length: ${count} }, (_, index) =>
  defineScreen({ path: \`fixture/nested/screen-\${index}\`, title: \`Screen \${index}\`, description: "Generated screen", relatedDocs: [], desktop: <main>${label} {index}</main>, mobile: <main>${label} {index}</main> }),
);
`;
}

/** Every regular file below `root`, as sorted POSIX paths relative to it. */
export async function treeFiles(root: string, prefix = ""): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await fs.readdir(path.join(root, prefix), {
    withFileTypes: true,
  })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...(await treeFiles(root, relative)));
    else found.push(relative);
  }
  return found.sort();
}

/** Reject with the first failure only after every operation has settled. */
export async function allSettledOrThrow<Value>(
  operations: readonly Promise<Value>[],
): Promise<Value[]> {
  const outcomes = await Promise.allSettled(operations);
  for (const outcome of outcomes)
    if (outcome.status === "rejected") throw outcome.reason;
  return outcomes.map(
    (outcome) => (outcome as PromiseFulfilledResult<Value>).value,
  );
}
