import assert from "node:assert/strict";
import test from "node:test";

import { NodeBaselineExecutableResolver } from "../packages/mokly/dist/baseline/executable.js";

for (const command of ["npm", "npx", "npm.cmd", "npx.cmd"]) {
  test(`Windows ${command} uses the selected installation and preserves literal argv`, async () => {
    const name = command.split(".")[0]!;
    const directory = "C:\\Program Files\\npm";
    const script = `${directory}\\node_modules\\npm\\bin\\${name}-cli.js`;
    const resolver = new NodeBaselineExecutableResolver({
      platform: "win32",
      nodeExecutable: "C:\\node\\node.exe",
      isFile: async (file) =>
        [script, `${directory}\\${name}.cmd`].includes(file),
    });
    const args = ["run", "a & b", "%PATH%", "", 'quote"value'];
    assert.deepEqual(
      await resolver.resolve({
        argv: [command, ...args],
        cwd: "C:\\source",
        env: { Path: `C:\\empty;${directory}` },
      }),
      ["C:\\node\\node.exe", script, ...args],
    );
  });
}

test("an unsupported npm shim fails without silently choosing a different installation", async () => {
  const resolver = new NodeBaselineExecutableResolver({
    platform: "win32",
    nodeExecutable: "C:\\node.exe",
    isFile: async (file) => file.endsWith("npm.cmd"),
  });
  await assert.rejects(
    resolver.resolve({
      argv: ["npm", "ci"],
      cwd: "C:\\source",
      env: { PATH: "C:\\custom;C:\\fallback" },
    }),
    /JavaScript entry point/,
  );
});

for (const command of ["npm", "npx"]) {
  for (const extension of ["exe", "com"]) {
    test(`Windows ${command} preserves an earlier native ${extension} launcher`, async () => {
      const native = `C:\\toolchain\\${command}.${extension}`;
      const resolver = windowsResolver([
        native,
        `C:\\node\\${command}.cmd`,
        `C:\\node\\node_modules\\npm\\bin\\${command}-cli.js`,
      ]);
      assert.deepEqual(
        await resolver.resolve({
          argv: [command, "run", "a & b", ""],
          cwd: "C:\\source",
          env: { Path: "C:\\toolchain;C:\\node" },
        }),
        [native, "run", "a & b", ""],
      );
    });
  }
}

test("Windows lookup checks the working directory before PATH", async () => {
  const resolver = windowsResolver([
    "C:\\source\\npm.exe",
    "C:\\node\\npm.cmd",
    "C:\\node\\node_modules\\npm\\bin\\npm-cli.js",
  ]);
  assert.deepEqual(
    await resolver.resolve({
      argv: ["npm", "ci"],
      cwd: "C:\\source",
      env: { PATH: "C:\\node" },
    }),
    ["C:\\source\\npm.exe", "ci"],
  );
});

test("Windows lookup honors PATHEXT order within the selected directory", async () => {
  const script = "C:\\node\\node_modules\\npm\\bin\\npm-cli.js";
  const resolver = windowsResolver([
    "C:\\node\\npm.exe",
    "C:\\node\\npm.cmd",
    script,
  ]);
  const request = {
    argv: ["npm", "ci"],
    cwd: "C:\\source",
    env: { Path: "C:\\node", PathExt: ".EXE;.CMD" },
  };
  assert.deepEqual(await resolver.resolve(request), [
    "C:\\node\\npm.exe",
    "ci",
  ]);
  assert.deepEqual(
    await resolver.resolve({
      ...request,
      env: { ...request.env, PathExt: ".CMD;.EXE" },
    }),
    ["C:\\node\\node.exe", script, "ci"],
  );
});

test("explicit Windows cmd paths do not switch to an adjacent native launcher", async () => {
  const script = "C:\\node\\node_modules\\npm\\bin\\npm-cli.js";
  const resolver = windowsResolver([
    "C:\\node\\npm.exe",
    "C:\\node\\npm.cmd",
    script,
  ]);
  assert.deepEqual(
    await resolver.resolve({
      argv: ["C:\\node\\npm.cmd", "ci"],
      cwd: "C:\\source",
      env: { PATHEXT: ".EXE" },
    }),
    ["C:\\node\\node.exe", script, "ci"],
  );
});

test("Windows lookup rejects an unsupported selected batch file instead of skipping it", async () => {
  const resolver = windowsResolver([
    "C:\\toolchain\\npm.bat",
    "C:\\node\\npm.cmd",
    "C:\\node\\node_modules\\npm\\bin\\npm-cli.js",
  ]);
  await assert.rejects(
    resolver.resolve({
      argv: ["npm", "ci"],
      cwd: "C:\\source",
      env: { PATH: "C:\\toolchain;C:\\node" },
    }),
    /Unsupported Windows baseline launcher/,
  );
});

function windowsResolver(files: readonly string[]) {
  return new NodeBaselineExecutableResolver({
    platform: "win32",
    nodeExecutable: "C:\\node\\node.exe",
    isFile: async (file) => files.includes(file),
  });
}
