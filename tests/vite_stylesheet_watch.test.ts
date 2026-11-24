import assert from "node:assert/strict";
import test from "node:test";

import { readCatalogueIndex } from "../packages/viewer/src/catalogue/index_reader.js";
import { startServe } from "../scripts/verification/serve-process.mjs";

import { component, stylesheetConfig } from "./fixtures/vite_stylesheets.js";
import { consumer, shim } from "./helpers/mokly_serve.js";
import { write } from "./helpers/static_changes.js";

test("Vite watches composition files and renders again when their contents change", async (context) => {
  const root = await consumer(context, {
    "mokly.config.json": stylesheetConfig([]),
    "src/card.mockup.tsx": component(
      'import styles from "./card.module.css"; import { readFileSync } from "node:fs";',
      `<p className={styles.card}>{readFileSync(new URL('./composed.css', import.meta.url), 'utf8').includes('teal') ? 'Before' : 'After'}</p>`,
    ),
    "src/card.module.css":
      '.card { composes: extra from "./composed.css"; display: block }',
    "src/composed.css": ".extra { color: teal }",
  });
  await watch(root, context.signal, async ({ render, publish, stylesheet }) => {
    assert.match(
      await render(),
      /class="mokly_[\w-]+_card mokly_[\w-]+_extra">Before<\/p>/,
    );
    await publish(() =>
      write(root, "src/composed.css", ".extra { color: maroon }"),
    );
    assert.match(await render(), />After<\/p>/);
    assert.match(
      await stylesheet("src/card.mockup.tsx.css"),
      /\.mokly_[\w-]+_extra\s*\{[^}]*color:\s*maroon/,
    );
  });
});

test("a Vite input reported by configured CSS rerenders JavaScript without a CSS change", async (context) => {
  const root = await consumer(context, {
    "mokly.config.json": stylesheetConfig(["styles/site.css"]),
    "vite.config.ts": `import { resolve } from 'node:path';
export default { plugins: [{ name: 'report-copy', transform(_code, id) {
  if (id.endsWith('/styles/site.css?inline')) this.addWatchFile(resolve('data/copy.txt'));
} }] };`,
    "src/card.mockup.tsx": component(
      'import { readFileSync } from "node:fs";',
      `<p>{readFileSync(new URL('../data/copy.txt', import.meta.url), 'utf8')}</p>`,
    ),
    "styles/site.css": ".card { color: teal }",
    "data/copy.txt": "Before",
  });
  await watch(root, context.signal, async ({ render, publish, stylesheet }) => {
    assert.match(await render(), />Before<\/p>/);
    const before = await stylesheet("styles/site.css");
    await publish(() => write(root, "data/copy.txt", "After"));
    assert.match(await render(), />After<\/p>/);
    assert.equal(await stylesheet("styles/site.css"), before);
  });
});

async function watch(
  root: string,
  cancelled: AbortSignal,
  check: (input: {
    render: () => Promise<string>;
    publish: (edit: () => Promise<void>) => Promise<void>;
    stylesheet: (file: string) => Promise<string>;
  }) => Promise<void>,
) {
  const server = await startServe(
    [shim, "serve", "--watch", "--port=0", "--sidecars=1"],
    {
      cwd: root,
      env: { MOKLY_OUTPUT: "plain" },
    },
  );
  try {
    const signal = AbortSignal.any([cancelled, AbortSignal.timeout(30_000)]);
    const url = await server.listening(signal);
    const generation = async () => {
      const response = await fetch(`${url}/mokly-viewer/index.json`, {
        signal,
      });
      assert.equal(response.status, 200);
      return readCatalogueIndex(await response.json()).live?.generation;
    };
    const generated = async (file: string) => {
      const response = await fetch(`${url}/static/mokly-generated/${file}`, {
        signal,
      });
      const html = await response.text();
      assert.equal(response.status, 200, html);
      return html;
    };
    const events = await fetch(`${url}/mokly-viewer/events`, { signal });
    assert.equal(events.status, 200);
    assert.ok(events.body);
    const updates = events.body
      .pipeThrough(new TextDecoderStream())
      .getReader();
    let pending = "";
    const publication = async () => {
      while (!pending.includes("\n\n")) {
        const next = await updates.read();
        assert.equal(next.done, false, server.diagnostics());
        pending += next.value;
      }
      const end = pending.indexOf("\n\n");
      const event = pending.slice(0, end);
      pending = pending.slice(end + 2);
      return event;
    };
    try {
      const initial = await publication();
      assert.match(initial, /^id: \d+/);
      await check({
        render: () => generated("card/index.mobile.html"),
        publish: async (edit) => {
          const previous = await generation();
          assert.ok(previous);
          await edit();
          do {
            await publication();
          } while ((await generation()) === previous);
        },
        stylesheet: (file) => generated(`styles/${file}`),
      });
    } finally {
      if (!signal.aborted) await updates.cancel();
    }
  } finally {
    await server.stop();
  }
}
