import { fork } from "node:child_process";
import type { TestContext } from "node:test";

import { build } from "esbuild";

import { PostcssWorkers } from "../../packages/mokly/dist/sidecar/postcss.js";
import { Session } from "../../packages/mokly/dist/sidecar/session.js";
import type { Operation } from "../../packages/mokly/src/generated/sidecar/Operation.js";

/** Match the plain Node child that the native sidecar launcher starts. */
export function preparedSession(
  context: TestContext,
  compile: typeof build = build,
  operation: (operation: Operation) => void = () => {},
) {
  const diagnostic = (message: string) => context.diagnostic(message);
  const session = new Session(
    "test",
    diagnostic,
    compile,
    operation,
    undefined,
    undefined,
    new PostcssWorkers(diagnostic, operation, (file, args, options) =>
      fork(file, args, { ...options, execArgv: [] }),
    ),
  );
  context.after(() => session.dispose());
  return session;
}
