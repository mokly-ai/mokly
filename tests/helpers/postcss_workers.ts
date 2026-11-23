import { ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { TestContext } from "node:test";

import type { ProcessCssParams } from "../../packages/mokly/src/generated/sidecar/ProcessCssParams.js";
import { PostcssWorkers } from "../../packages/mokly/src/sidecar/postcss.js";

import { cssParams } from "./sidecar.js";

class Child extends ChildProcess {
  override exitCode: number | null = null;
}

export function controlledPostcss(context: TestContext): {
  workers: PostcssWorkers;
  children: ChildProcess[];
  messages: unknown[];
  params: ProcessCssParams;
} {
  context.mock.method(fs.promises, "realpath", async (file: unknown) =>
    String(file),
  );
  const children: ChildProcess[] = [];
  const messages: unknown[] = [];
  const workers = new PostcssWorkers(
    () => {},
    () => {},
    () => {
      const child = new Child();
      child.send = (message) => {
        messages.push(message);
        if (message && typeof message === "object" && "id" in message)
          child.emit("message", {
            id: message.id,
            result: {
              text: "a{}",
              dependencies: [],
              readEvidence: { coverage: "incomplete", reads: [], modules: [] },
              unmappedDependencyDirectories: [],
            },
          });
        return true;
      };
      context.mock.method(child, "kill", () => {
        child.exitCode = 0;
        child.emit("exit", 0, null);
        return true;
      });
      children.push(child);
      return child;
    },
  );
  context.after(() => workers.dispose());
  const params = cssParams({
    sourceRoot: path.resolve("repo"),
    moduleResolution: {
      aliases: {},
      conditions: [],
      loaders: {},
      mainFields: [],
      packageRoots: [],
      resolveExtensions: [],
    },
  });
  return { workers, children, messages, params };
}
