import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { processListing } from "./process-tree.mjs";

/** Persist every descendant group before a signal can reparent its processes. */
export function captureProcessGroups(registry, records) {
  if (process.platform === "win32" || records.length === 0) return records;
  const rows = processListing();
  const groups = new Set(records.map((record) => record.processGroupId));
  const captured = [...records];
  for (const record of records) {
    const parents = new Set(
      rows
        .filter((row) => row.pgid === record.processGroupId)
        .map((row) => row.pid),
    );
    for (let grown = true; grown;) {
      grown = false;
      for (const row of rows) {
        if (!parents.has(row.ppid) || parents.has(row.pid)) continue;
        parents.add(row.pid);
        grown = true;
        if (row.zombie || groups.has(row.pgid)) continue;
        const file = path.join(registry, `process-${randomUUID()}.json`);
        const temporary = `${file}.tmp`;
        const value = {
          schemaVersion: 1,
          type: "process",
          ownerId: record.ownerId,
          processGroupId: row.pgid,
        };
        fs.writeFileSync(temporary, JSON.stringify(value), {
          flag: "wx",
          mode: 0o600,
        });
        fs.renameSync(temporary, file);
        captured.push({ ...value, file });
        groups.add(row.pgid);
      }
    }
  }
  return captured;
}

export function signalProcessGroup(processGroupId, signal) {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(processGroupId), "/T", "/F"], {
      stdio: "ignore",
    });
    return;
  }
  try {
    process.kill(-processGroupId, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

/** Zombies have exited; their parent alone owns reaping them. */
export function liveProcessGroups() {
  if (process.platform !== "win32")
    return new Set(
      processListing()
        .filter((row) => !row.zombie)
        .map((row) => row.pgid),
    );
}

export function processGroupExists(processGroupId, liveGroups) {
  if (liveGroups) return liveGroups.has(processGroupId);
  try {
    process.kill(processGroupId, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    if (error?.code === "EPERM") return true;
    throw error;
  }
}
