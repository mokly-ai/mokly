import assert from "node:assert/strict";
import test from "node:test";

import { consumer, serve } from "./helpers/mokly_serve.js";

if (process.platform !== "win32")
  for (const stage of ["render", "describe"])
    test(
      `one process-group signal through the shim cancels a hung ${stage} and exits zero`,
      { timeout: 60_000 },
      async (context) => {
        const hung =
          "process.stderr.write('sidecar-ready:'+process.pid+'\\n');while(true){}";
        const source =
          stage === "render"
            ? `import {defineScreen} from '@mokly/mokly';export default defineScreen({title:'Hang',description:'',relatedDocs:[],props:{},render(){${hung}}});`
            : `${hung}; export const unused=1;`;
        const root = await consumer(context, {
          "specs/hang.mockup.ts": source,
        });
        const running = serve(context, root, true);
        if (stage === "render") await running.ready();
        const pid = Number(
          (await running.wait("stderr", /sidecar-ready:(\d+)/))[1],
        );
        assert.ok(pid > 0);
        process.kill(-running.child.pid!, "SIGINT");
        const [status, signal] = await running.exited;
        assert.equal(status, 0, running.output.stderr);
        assert.equal(signal, null);
        assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
        assert.doesNotMatch(running.output.stderr, /\[mokly\//);
      },
    );
