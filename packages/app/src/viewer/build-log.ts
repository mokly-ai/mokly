import type { BuildLog, BuildLogChunk, BuildLogElision } from "../api/types";
import { logWindowLimit } from "../data/builds";

import { elisionText } from "./build-copy";

/**
 * The most text one log window holds before its next chunk might not fit: the
 * API stops a window at 256 KiB, and one stored chunk is at most 64 KiB.
 */
const fullWindowBytes = 262_144 - 65_536;

/**
 * How much output after the head the reader keeps once Mokly has dropped some:
 * what Mokly itself keeps, one MiB less the first 256 KiB. A reader watching a
 * build that writes without end keeps what Mokly keeps rather than all of it.
 */
export const keptTailBytes = 1_048_576 - 262_144;

/** One chunk the reader holds, with the size it counts against the tail. */
interface HeldChunk {
  sequence: number;
  stream: BuildLogChunk["stream"];
  text: string;
  bytes: number;
}

/** What the reader has read of one build's log. */
export interface LogView {
  /** The attempt the held chunks belong to; a newer one replaces them. */
  attempt?: number;
  chunks: readonly HeldChunk[];
  /** The sequence the next window is read after. */
  after: number;
  /** Whether Mokly will write nothing more after `after`. */
  complete: boolean;
  /** Where retained output was dropped, while some was. */
  elision: BuildLogElision | null;
}

/** A log nothing has been read of yet. */
export const emptyLog: LogView = {
  chunks: [],
  after: 0,
  complete: false,
  elision: null,
};

const encoder = new TextEncoder();

/** The UTF-8 size of one chunk's text, which is what the API's limits count. */
function utf8Bytes(text: string): number {
  return encoder.encode(text).length;
}

/**
 * Whether a window may have stopped at its limit with more behind it, so the
 * reader reads the next one at once rather than at the next interval.
 */
export function windowFull(window: BuildLog): boolean {
  if (window.chunks.length >= logWindowLimit) return true;
  const bytes = window.chunks.reduce(
    (total, chunk) => total + utf8Bytes(chunk.text),
    0,
  );
  return bytes > fullWindowBytes;
}

/** Drop the oldest output after the head until the tail is what Mokly keeps. */
function trimmed(
  chunks: HeldChunk[],
  elision: BuildLogElision | null,
): HeldChunk[] {
  if (!elision) return chunks;
  let tail = chunks
    .filter((chunk) => chunk.sequence > elision.afterSequence)
    .reduce((total, chunk) => total + chunk.bytes, 0);
  return chunks.filter((chunk) => {
    if (chunk.sequence <= elision.afterSequence || tail <= keptTailBytes) {
      return true;
    }
    tail -= chunk.bytes;
    return false;
  });
}

/**
 * Add one window to what the reader holds. A chunk from a newer attempt
 * replaces the output of the older one, a chunk already held is not held twice,
 * and a late chunk of an older attempt is not shown over the newer one.
 */
export function receiveWindow(view: LogView, window: BuildLog): LogView {
  let attempt = view.attempt;
  let chunks = [...view.chunks];
  for (const chunk of window.chunks) {
    if (attempt !== undefined && chunk.attempt < attempt) continue;
    if (attempt !== undefined && chunk.attempt > attempt) chunks = [];
    attempt = chunk.attempt;
    const last = chunks[chunks.length - 1];
    if (last && chunk.sequence <= last.sequence) continue;
    chunks.push({
      sequence: chunk.sequence,
      stream: chunk.stream,
      text: chunk.text,
      bytes: utf8Bytes(chunk.text),
    });
  }
  return {
    attempt,
    chunks: trimmed(chunks, window.elision),
    after: Math.max(view.after, window.nextAfter),
    complete: window.complete,
    elision: window.elision,
  };
}

/** One line the output draws. */
export interface OutputLine {
  /** `system` lines are quiet; `ink` is the build's own output. */
  kind: "ink" | "system" | "elision";
  text: string;
}

/** A system chunk's lines; the newline that ends the chunk ends its last line. */
function systemLines(text: string): string[] {
  const lines = text.split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/**
 * The output as lines. Standard output and standard error read alike; a
 * command or result line Mokly wrote starts a line of its own; and one line
 * marks where retained output was dropped, after the head Mokly kept.
 */
export function outputLines(view: LogView): OutputLine[] {
  const lines: OutputLine[] = [];
  let open: OutputLine | undefined;
  let elision = view.elision;
  const close = () => {
    if (open) lines.push(open);
    open = undefined;
  };
  const elide = () => {
    if (!elision) return;
    close();
    lines.push({ kind: "elision", text: elisionText(elision.bytes) });
    elision = null;
  };
  for (const chunk of view.chunks) {
    if (elision && chunk.sequence > elision.afterSequence) elide();
    if (chunk.stream === "system") {
      close();
      for (const text of systemLines(chunk.text)) {
        lines.push({ kind: "system", text });
      }
      continue;
    }
    chunk.text.split("\n").forEach((part, index) => {
      if (index > 0) {
        lines.push(open ?? { kind: "ink", text: "" });
        open = undefined;
      }
      if (part.length > 0) {
        open = { kind: "ink", text: (open?.text ?? "") + part };
      }
    });
  }
  close();
  elide();
  return lines;
}
