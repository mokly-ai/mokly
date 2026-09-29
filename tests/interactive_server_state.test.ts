import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { loadConfig } from "../dist/config/load.js";
import {
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { defaultInteractivePort } from "../dist/server/http_interactive.js";
import { serve } from "../dist/server/serve.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";
import {
  interactiveServerFixture,
  removeInteractiveFixture,
} from "./helpers/interactive_server.js";
import { closeServers, occupyConsecutivePorts } from "./helpers/ports.js";

test("Live descriptor stays private and reports readiness updates", async (t) => {
  const explicitOrigin = "https://live.forwarded.example";
  const live = await interactiveServerFixture({
    interactiveOrigin: explicitOrigin,
  });
  t.after(() => removeInteractiveFixture(live.fixture));
  const home = await (await fetch(live.server.url)).text();
  const descriptor = privateDescriptor(home);
  assert.deepEqual(descriptor.interactive, {
    generation: live.generation,
    origin: explicitOrigin,
    port: live.server.interactivePort,
    state: "idle",
  });
  const publicBytes = await (
    await fetch(`${live.server.url}/__mokly/catalogue.json`)
  ).text();
  assert.doesNotMatch(publicBytes, /live\.forwarded\.example/);
  assert.doesNotMatch(
    publicBytes,
    new RegExp(String(live.server.interactivePort)),
  );

  const events = await fetch(`${live.server.url}/__mokly/events`);
  const reader = events.body?.getReader();
  assert.ok(reader);
  assert.match(await readEvents(reader, 'state":"idle'), /event: ready/);
  const route = `${live.liveUrl}/static/${live.mobileRoute}`;
  assert.equal((await fetch(route)).status, 503);
  assert.match(
    await readEvents(reader, 'state":"building'),
    /event: interactive/,
  );
  live.bundler.succeed(live.generation);
  assert.match(await readEvents(reader, 'state":"ready'), /event: interactive/);
  await reader.cancel();
});

test("Live generation changes rebuild and retain only one predecessor", async (t) => {
  const live = await interactiveServerFixture();
  t.after(() => removeInteractiveFixture(live.fixture));
  const route = `${live.liveUrl}/static/${live.mobileRoute}`;
  assert.equal((await fetch(route)).status, 503);
  live.bundler.succeed(live.generation, "export const first = true;");
  await prepare(live.server.url, live.generation);

  const secondGeneration = "b".repeat(32);
  live.server.replaceComponentRuntime({
    ...live.runtime,
    generation: secondGeneration,
  });
  assert.equal((await fetch(route)).status, 503);
  assert.deepEqual(
    live.bundler.requests.map(({ generation }) => generation),
    [live.generation, secondGeneration],
  );
  assert.strictEqual(
    live.bundler.requests[0]?.sources,
    live.runtime.interactiveSources,
  );
  assert.strictEqual(
    live.bundler.requests[1]?.sources,
    live.runtime.interactiveSources,
  );
  assert.equal(
    (
      await fetch(
        `${live.liveUrl}/__mokly/interactive/${live.generation}/bundle.js`,
      )
    ).status,
    200,
  );

  const thirdGeneration = "c".repeat(32);
  live.server.replaceComponentRuntime({
    ...live.runtime,
    generation: thirdGeneration,
  });
  assert.deepEqual(live.bundler.invalidated, [live.generation]);
  assert.equal(
    (
      await fetch(
        `${live.liveUrl}/__mokly/interactive/${live.generation}/bundle.js`,
      )
    ).status,
    404,
  );
  const latest = privateDescriptor(await (await fetch(live.server.url)).text());
  assert.deepEqual(latest.interactive, {
    generation: thirdGeneration,
    port: live.server.interactivePort,
    state: "idle",
  });
});

test(
  "watched Serve adopts a new Live generation and rebuilds lazily",
  { timeout: 30_000 },
  async (t) => {
    const fixture = await createFixture(validEntrySource(), {
      extraConfig: 'interactive: "serve", watch: { debounceMs: 0 },',
    });
    t.after(() => removeFixture(fixture));
    const running = await serve(await loadConfig(fixture.root), {
      port: 0,
      watch: true,
    });
    fixture.beforeRemove(() => running.close());
    assert.ok(running.interactiveOrigin);
    assert.ok(running.rebuild);

    const first = descriptorGeneration(await (await fetch(running.url)).text());
    await prepare(running.url, first);
    assert.equal(
      (
        await fetch(
          `${running.interactiveOrigin}/__mokly/interactive/${first}/bundle.js`,
        )
      ).status,
      200,
    );

    running.rebuild();
    const second = await waitForGeneration(running.url, first);
    assert.notEqual(second, first);
    const beforePreparation = privateDescriptor(
      await (await fetch(running.url)).text(),
    );
    assert.equal(beforePreparation.interactive?.["state"], "idle");
    await prepare(running.url, second);
    assert.equal(
      (
        await fetch(
          `${running.interactiveOrigin}/__mokly/interactive/${second}/bundle.js`,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await fetch(
          `${running.interactiveOrigin}/__mokly/interactive/${first}/bundle.js`,
        )
      ).status,
      200,
    );
  },
);

test("Live ports advance, honor strict mode and allow OS selection", async (t) => {
  const defaults = await occupyConsecutivePorts(2);
  const [appBlocker, liveBlocker] = defaults.servers;
  assert.ok(appBlocker && liveBlocker);
  await closeServers([appBlocker]);
  t.after(() => closeServers([liveBlocker]));
  const defaulted = await interactiveServerFixture({ port: defaults.start });
  t.after(() => removeInteractiveFixture(defaulted.fixture));
  assert.equal(defaulted.server.port, defaults.start);
  assert.equal(defaulted.server.interactivePort, defaults.start + 2);

  const occupied = await occupyConsecutivePorts(1);
  t.after(() => closeServers(occupied.servers));
  const advanced = await interactiveServerFixture({
    interactivePort: occupied.start,
  });
  t.after(() => removeInteractiveFixture(advanced.fixture));
  assert.equal(advanced.server.interactivePort, occupied.start + 1);
  await assert.rejects(
    interactiveServerFixture({
      interactivePort: occupied.start,
      strictPort: true,
    }),
    new RegExp(`could not bind port ${String(occupied.start)}`),
  );
  const selected = await interactiveServerFixture({ interactivePort: 0 });
  t.after(() => removeInteractiveFixture(selected.fixture));
  assert.ok((selected.server.interactivePort ?? 0) > 0);
});

test("Live delegates its default port when the app uses 65535", () => {
  assert.equal(defaultInteractivePort(65_534), 65_535);
  assert.equal(defaultInteractivePort(65_535), 0);
});

test("Live bundle preparation records one timing span", async (t) => {
  const events: TimingEvent[] = [];
  const live = await runWithTimings(
    true,
    "test",
    () => interactiveServerFixture(),
    { write: (event) => events.push(event) },
  );
  t.after(() => removeInteractiveFixture(live.fixture));
  const route = `${live.liveUrl}/static/${live.mobileRoute}`;
  assert.equal((await fetch(route)).status, 503);
  live.bundler.succeed(live.generation);
  await prepare(live.server.url, live.generation);
  assert.deepEqual(
    events
      .filter((event) => event.stage === "interactive.bundle")
      .map(({ event, status }) => [event, status]),
    [
      ["start", undefined],
      ["end", "ok"],
    ],
  );
});

async function prepare(origin: string, generation: string): Promise<void> {
  const response = await fetch(
    `${origin}/__mokly/interactive/${generation}/prepare`,
    { headers: { origin }, method: "POST" },
  );
  assert.equal(response.status, 200);
}

function privateDescriptor(html: string): {
  interactive?: Record<string, unknown>;
} {
  const state = html.match(
    /data-mokly-host-capability-state="" type="application\/json">([^<]+)<\/script>/,
  )?.[1];
  assert.ok(state);
  return JSON.parse(state) as { interactive?: Record<string, unknown> };
}

function descriptorGeneration(html: string): string {
  const generation = privateDescriptor(html).interactive?.["generation"];
  if (typeof generation !== "string")
    throw new Error("Live descriptor generation is missing");
  return generation;
}

async function waitForGeneration(
  origin: string,
  previous: string,
): Promise<string> {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const generation = descriptorGeneration(await (await fetch(origin)).text());
    if (generation !== previous) return generation;
    await delay(25);
  }
  throw new Error("watched Live generation did not advance");
}

async function readEvents(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  expected: string,
): Promise<string> {
  let received = "";
  while (!received.includes(expected)) {
    const next = await reader.read();
    if (next.done) throw new Error(`Event stream ended before ${expected}`);
    received += Buffer.from(next.value).toString("utf8");
  }
  return received;
}
