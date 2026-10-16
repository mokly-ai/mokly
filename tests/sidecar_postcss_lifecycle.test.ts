import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";

import { cssParams, startSidecar } from "./helpers/sidecar.js";
import { dependency, sidecarSources } from "./helpers/sidecar_sources.js";

async function exited(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0);
    if (process.platform === "linux") {
      const status = await fs.readFile(`/proc/${pid}/status`, "utf8");
      return /^State:\s+Z/m.test(status);
    }
    return false;
  } catch (error) {
    assert.ok(
      error &&
        typeof error === "object" &&
        "code" in error &&
        (error.code === "ESRCH" || error.code === "ENOENT"),
    );
    return true;
  }
}

for (const action of ["disposeContext", "shutdown", "kill"] as const) {
  test(
    `PostCSS child exits after ${action}`,
    { timeout: 60_000 },
    async (context) => {
      const { base } = await sidecarSources(context);
      const server = net.createServer();
      context.after(() => server.close());
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      const address = server.address();
      assert.ok(address && typeof address === "object");
      const connected = once(server, "connection");
      await fs.writeFile(
        path.join(base, "postcss.mjs"),
        `import net from "node:net"; import {once} from "node:events";
const socket = net.createConnection({host:"127.0.0.1",port:${address.port}});
const connected = once(socket,"connect");
export default {plugins:[{postcssPlugin:"pid",async Once(root){
    await connected;
    root.append({selector:".child",nodes:[{prop:"pid",value:String(process.pid)}]});
}}]};`,
      );
      const sidecar = startSidecar(context);
      await sidecar.call("hello");
      const result = await sidecar.call<CssResult>(
        "processCss",
        cssParams({
          sourceRoot: base,
          context: "child",
          postcss: "postcss.mjs",
        }),
      );
      const pid = Number(/pid:\s*(\d+)/.exec(result.text)?.[1]);
      assert.ok(Number.isInteger(pid) && pid > 0 && pid !== sidecar.child.pid);
      assert.equal(await exited(pid), false);
      const [socket] = (await connected) as [net.Socket];
      socket.resume();
      context.after(() => socket.destroy());
      const closed = once(socket, "close");
      if (action === "kill") sidecar.child.kill("SIGKILL");
      else
        await sidecar.call(
          action,
          action === "disposeContext" ? { context: "child" } : {},
        );
      await closed;
      const deadline = Date.now() + 10_000;
      while (!(await exited(pid)) && Date.now() < deadline)
        await setTimeout(10);
      assert.equal(await exited(pid), true);
      if (action === "disposeContext") await sidecar.call("shutdown");
    },
  );
}

test("PostCSS puts selected dependency roots before inherited NODE_PATH", async (context) => {
  const { root, base } = await sidecarSources(context);
  const inherited = [
    path.join(root, "inherited-one"),
    path.join(root, "inherited-two"),
  ];
  await fs.writeFile(
    path.join(base, "postcss.mjs"),
    `export default {plugins:[{postcssPlugin:"environment",Once(root){
      root.append({selector:".env",nodes:[{prop:"value",value:JSON.stringify(process.env.NODE_PATH)}]});
    }}]};`,
  );
  const params = cssParams({ sourceRoot: base, postcss: "postcss.mjs" });
  const sidecar = startSidecar(context, undefined, {
    ...process.env,
    NODE_PATH: inherited.join(path.delimiter),
  });
  await sidecar.call("hello");
  const result = await sidecar.call<CssResult>("processCss", params);
  const selected = await Promise.all(
    params.moduleResolution.packageRoots.map((root) =>
      fs.realpath(path.join(root, "node_modules")),
    ),
  );
  assert.ok(
    result.text.includes(
      JSON.stringify([...selected, ...inherited].join(path.delimiter)),
    ),
    result.text,
  );
  await sidecar.call("shutdown");
});

test("PostCSS reports the installed package files it resolves", async (context) => {
  const { base } = await sidecarSources(context);
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  for (const mode of ["static", "record", "dynamic", "require"]) {
    const name = `fixture-${mode}`;
    const extension = mode === "require" ? "cjs" : "mjs";
    const module = await dependency(
      base,
      name,
      `${mode === "require" ? "module.exports=" : "export default "} () => ({postcssPlugin:"fixture",Once(root){root.append({selector:".loaded",nodes:[{prop:"value",value:"yes"}]});}});`,
      extension,
    );
    const config =
      mode === "static"
        ? `import plugin from '${name}'; export default {plugins:[plugin()]};`
        : mode === "record"
          ? `export default {plugins:{'${name}':{}}};`
          : mode === "dynamic"
            ? `const {default:plugin}=await import('${name}'); export default {plugins:[plugin()]};`
            : `const plugin=require('${name}'); export default {plugins:[plugin()]};`;
    await fs.writeFile(path.join(base, `${mode}.mjs`), config);
    const params = cssParams({
      sourceRoot: base,
      context: mode,
      postcss: `${mode}.mjs`,
    });
    params.moduleResolution.packageRoots = [base];
    const result = await sidecar.call<CssResult>("processCss", params);
    assert.match(result.text, /value: yes/);
    assert.ok(
      result.dependencies.some(
        (item) => item.path === path.join(module, `index.${extension}`),
      ),
      JSON.stringify(result.dependencies),
    );
  }
  await sidecar.call("shutdown");
});
