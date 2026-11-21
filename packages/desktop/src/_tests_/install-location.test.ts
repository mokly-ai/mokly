import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { offerApplicationsMove, readOnlyFolder } from "../install-location.js";
import type { InstallLocationDependencies } from "../install-location.js";

async function fixture(
  options: {
    readOnly?: boolean;
    updates?: boolean;
    platform?: string;
    inApplications?: boolean;
    response?: number;
  } = {},
) {
  const userData = await mkdtemp(join(tmpdir(), "mokly-install-"));
  const events: string[] = [];
  const dependencies: InstallLocationDependencies = {
    updates: options.updates ?? true,
    platform: options.platform ?? "darwin",
    version: "0.1.0",
    executable: "/Volumes/Mokly/Mokly.app/Contents/MacOS/Mokly",
    userData,
    inApplications: () => options.inApplications ?? false,
    readOnly: async (folder) => {
      events.push(`probe ${folder}`);
      return options.readOnly ?? false;
    },
    showDialog: async (dialog) => {
      events.push(String(dialog.message));
      return { response: options.response ?? 1 };
    },
    move: () => {
      events.push("move");
      return true;
    },
    warn: (error) => {
      events.push(`warn ${String(error)}`);
    },
  };
  const cleanup = () => rm(userData, { recursive: true, force: true });
  return { dependencies, events, userData, cleanup };
}

test("a copy in a read-only place offers the move", async () => {
  const moved = await fixture({ readOnly: true, response: 0 });
  await offerApplicationsMove(moved.dependencies);
  assert.deepEqual(moved.events, [
    "probe /Volumes/Mokly",
    "Move Mokly to Applications to get updates.",
    "move",
  ]);
  await moved.cleanup();
});

test("Not now hides the dialog until another version runs", async () => {
  const later = await fixture({ readOnly: true });
  const dialogs = () =>
    later.events.filter((event) => event.startsWith("Move Mokly")).length;
  await offerApplicationsMove(later.dependencies);
  await offerApplicationsMove(later.dependencies);
  assert.equal(dialogs(), 1);
  assert.equal(
    await readFile(
      join(later.userData, "install-location-dismissed-version"),
      "utf8",
    ),
    "0.1.0",
  );
  later.dependencies.version = "0.2.0";
  await offerApplicationsMove(later.dependencies);
  assert.equal(dialogs(), 2);
  await later.cleanup();
});

test("no dialog in a writable folder, in Applications, off macOS or without updates", async () => {
  for (const options of [
    {},
    { readOnly: true, inApplications: true },
    { readOnly: true, platform: "linux" },
    { readOnly: true, updates: false },
  ]) {
    const quiet = await fixture(options);
    await offerApplicationsMove(quiet.dependencies);
    assert.equal(
      quiet.events.some((event) => event.startsWith("Move Mokly")),
      false,
      JSON.stringify(options),
    );
    await quiet.cleanup();
  }
});

test("only a read-only file system counts, and the probe leaves nothing", async () => {
  const folder = await mkdtemp(join(tmpdir(), "mokly-probe-"));
  assert.equal(await readOnlyFolder(folder), false);
  assert.deepEqual(await readdir(folder), []);
  await rm(folder, { recursive: true, force: true });
  const failing = (code: string) => ({
    mkdtemp: async () => {
      throw Object.assign(new Error(code), { code });
    },
    rmdir: async () => {},
  });
  assert.equal(await readOnlyFolder("/Volumes/Mokly", failing("EROFS")), true);
  await assert.rejects(readOnlyFolder("/Volumes/Mokly", failing("EACCES")));
});
