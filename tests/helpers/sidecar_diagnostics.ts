import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { EventEmitter, once } from "node:events";
import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";
import { pathToFileURL } from "node:url";

import { platformPackage } from "../../packages/mokly/src/platform.mjs";
import { systemRuntime } from "../../packages/mokly/src/runtime.mjs";

import { listeningAddress } from "../../scripts/verification/serve-process.mjs";

import { consumer } from "./mokly_serve.js";
import { workspace } from "./static_publication.js";

export async function noisySidecar(
  context: TestContext,
  verb: "build" | "serve",
) {
  const root = await consumer(context, {
    "mokly.config.json":
      '{"postcss":"postcss.mjs","stylesheets":[{"match":"**","stylesheets":["theme.css"]}]}',
    "specs/home.screen.html": "---\ntitle: Home\n---\n<p>Home</p>",
    "theme.css": "p { color: red }",
    "postcss.mjs":
      "import fs from 'node:fs';fs.appendFileSync('.context/pids',process.pid+'\\n');export default {plugins:[]};",
  });
  const packageRoot = path.join(root, ".context/package");
  await fs.mkdir(path.join(packageRoot, "dist"), { recursive: true });
  await fs.writeFile(
    path.join(packageRoot, "package.json"),
    '{"type":"module"}',
  );
  const module = (file: string) =>
    pathToFileURL(path.join(workspace, "packages/mokly/dist", file)).href;
  await fs.writeFile(
    path.join(packageRoot, "dist/sidecar.js"),
    `
import fs from 'node:fs';
import {Session} from ${JSON.stringify(module("sidecar/session.js"))};
fs.appendFileSync('.context/pids',process.pid+'\\n');
process.on('exit',code=>fs.writeFileSync('.context/sidecar-exit',String(code)));
const original=Session.prototype.call;
let written=false;
const write=text=>new Promise((resolve,reject)=>process.stderr.write(text,error=>error?reject(error):resolve()));
Session.prototype.call=async function(request){
  if(!written && request.method===${JSON.stringify(verb === "build" ? "processCss" : "shutdown")}){
    written=true;
    for(let index=0;index<40;index++) await write('L'.repeat(65537)+'\\n');
    await write('R'.repeat(2*1024*1024+1));
    fs.writeFileSync('.context/stderr-complete','yes');
  }
  return original.call(this,request);
};
await import(${JSON.stringify(module("sidecar.js"))});
`,
  );
  const runtime = systemRuntime();
  const native = runtime.nativePackage(
    platformPackage(runtime.platform, runtime.architecture, runtime.glibc),
  );
  const child = spawn(
    native.binary,
    [
      verb,
      "--sidecars=1",
      ...(verb === "build"
        ? ["--no-changes", "--out=.context/site"]
        : ["--watch", "--port=0"]),
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        MOKLY_OUTPUT: "plain",
        MOKLY_PACKAGE_ROOT: packageRoot,
        MOKLY_NODE_EXECUTABLE: process.execPath,
        MOKLY_VIEWER_DIST: path.join(workspace, "packages/viewer/dist"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const stop = () => child.kill("SIGTERM");
  context.signal.addEventListener("abort", stop, { once: true });
  context.after(() => {
    child.kill("SIGKILL");
  });
  const updates = new EventEmitter();
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (bytes) => {
    stdout += String(bytes);
    updates.emit("output");
  });
  child.stderr.on("data", (bytes) => {
    stderr += String(bytes);
    updates.emit("output");
  });
  const result = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
    stdout: string;
    stderr: string;
  }>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      context.signal.removeEventListener("abort", stop);
      resolve({ code, signal, stdout, stderr });
    });
  });
  return {
    child,
    result,
    root,
    async ready() {
      while (!listeningAddress(stdout))
        await Promise.race([
          once(updates, "output", { signal: context.signal }),
          result.then((value) => {
            throw new Error(`Serve exited: ${value.stderr}`);
          }),
        ]);
      return listeningAddress(stdout)!;
    },
    async gitFailure() {
      while (!/^\[mokly\/git-failed\][^\n]*\n/mu.test(stderr))
        await Promise.race([
          once(updates, "output", { signal: context.signal }),
          result.then((value) => {
            throw new Error(
              `Serve exited before its Git diagnostic: ${value.stderr}`,
            );
          }),
        ]);
    },
    async completion() {
      const read = async (file: string) =>
        fs
          .readFile(path.join(root, ".context", file), "utf8")
          .catch((error: NodeJS.ErrnoException) => {
            if (error.code === "ENOENT") return null;
            throw error;
          });
      return {
        written: await read("stderr-complete"),
        exit: await read("sidecar-exit"),
      };
    },
    async assertStopped() {
      const pids = new Set(
        (await fs.readFile(path.join(root, ".context/pids"), "utf8"))
          .trim()
          .split("\n")
          .map(Number),
      );
      assert.ok(pids.size >= 2);
      for (const pid of pids)
        assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
    },
  };
}
