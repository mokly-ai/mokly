import { fileExportOperations } from "../../packages/mokly/dist/export/operations.js";

/** Process-isolated fault injection for exercising the real CLI error output. */
const mode = process.env["MOKLY_TEST_EXPORT_FAILURE"];
const originalRename = fileExportOperations.rename;
const originalRmdir = fileExportOperations.rmdir;
const cancelAfterBackup = [
  "cancellation",
  "publish-cancel-clean",
  "publish-cancel-restore-failure",
].includes(mode ?? "");

fileExportOperations.rename = async (from, to) => {
  if (mode === "rollback" && from.endsWith("/stage"))
    throw new Error("Injected install failure");
  if (mode === "rollback" && from.endsWith("/backup"))
    throw new Error("Injected restore failure");
  if (mode === "publish-cancel-restore-failure" && from.endsWith("/backup"))
    throw new Error("Injected restore failure after cancellation");
  await originalRename(from, to);
  if (cancelAfterBackup && to.endsWith("/backup")) process.emit("SIGTERM");
};

fileExportOperations.rmdir = async (candidate) => {
  if (mode === "backup" && candidate.endsWith("/backup"))
    throw new Error("Injected backup cleanup failure");
  await originalRmdir(candidate);
};

if (mode === "cancellation" || mode === "cleanup") {
  fileExportOperations.remove = async () => {
    throw new Error("Injected reservation cleanup failure");
  };
}
