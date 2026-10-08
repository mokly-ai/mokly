import fs from "node:fs/promises";

const PROCESS_ID = /^[1-9]\d*$/u;

/**
 * Read the process ID that a test's child process writes to a file.
 * A missing or blank file reads as not ready, because writeFileSync creates
 * the file before it writes the text. Other text and other read errors reject.
 */
export async function readPidFile(file: string): Promise<number | undefined> {
  let text: string;
  try {
    text = await fs.readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const pid = Number(trimmed);
  if (PROCESS_ID.test(trimmed) && Number.isSafeInteger(pid)) return pid;
  throw new Error(
    `Process ID file ${file} holds ${JSON.stringify(text)}, not a process ID`,
  );
}
