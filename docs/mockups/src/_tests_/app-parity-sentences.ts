import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ownerOf, parityPages, repository } from "./app-owners";
import type { ScreenId, SentenceDeclaration } from "./app-owners";
import { source } from "./app-parity-reads";
import { outputRoot } from "./catalogue-paths";

/** Where one declared sentence appears across a screen and its application. */
export interface SentencePresence {
  /** Generated pages for the screen that contain the exact sentence. */
  pages: string[];
  /** Whether any source declared as the screen's owner contains it. */
  written: boolean;
  /** Whether the named constant still holds this sentence in its own file. */
  declared: boolean;
}

/**
 * Locate one exact sentence in every generated page for a screen and in the
 * application source that owns it. Generated documents are read whole because
 * a dropped sentence must not survive in metadata outside the owned region.
 */
export function sentencePresence(
  screen: ScreenId,
  declaration: SentenceDeclaration,
): SentencePresence {
  const { sentence } = sentenceParts(declaration);
  const owner = ownerOf(screen);
  const pages = parityPages()
    .filter((page) => page.screen === screen)
    .filter((page) =>
      readFileSync(resolve(outputRoot, page.file), "utf8").includes(sentence),
    )
    .map((page) => page.id);
  return {
    pages,
    written: saysSentence(
      owner.files?.map(source).join("\n") ?? "",
      declaration,
    ),
    declared: declarationHolds(declaration),
  };
}

/** One sentence declaration in its parts, whichever form it was written in. */
export function sentenceParts(declaration: SentenceDeclaration): {
  sentence: string;
  constant?: { file: string; name: string };
} {
  return typeof declaration === "string"
    ? { sentence: declaration }
    : declaration;
}

/** One name matched only where it stands alone, never inside a longer one. */
function identifier(name: string): RegExp {
  return new RegExp("\\b" + escaped(name) + "\\b");
}

/** One string with every character a pattern would otherwise read as syntax. */
function escaped(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whether one source says a declared sentence in its own words or through its
 * shared constant. Looking for the literal alone misses a screen that renders
 * `{publicOnFree}`, so a declaration naming a constant also matches that exact
 * identifier.
 */
export function saysSentence(
  text: string,
  declaration: SentenceDeclaration,
): boolean {
  const { sentence, constant } = sentenceParts(declaration);
  if (text.includes(sentence)) return true;
  return constant !== undefined && identifier(constant.name).test(text);
}

/** Where one dropped sentence survives, and whether its home still holds it. */
export interface DroppedPresence {
  /** Generated pages for the screen that still contain the exact sentence. */
  pages: string[];
  /** Whether a source owning the screen still says it, either way. */
  written: boolean;
  /** Whether the named constant still holds this sentence in its own file. */
  declared: boolean;
}

/**
 * Locate one dropped sentence across a screen's generated pages and the
 * application sources that own it, and confirm the declaration is still true of
 * the product. A constant that has been renamed or given other words leaves the
 * table naming nothing, and a name nothing answers to is a search that passes
 * because it looked for the wrong thing — the same liveness every other home
 * table here keeps.
 */
export function droppedPresence(
  screen: ScreenId,
  dropped: SentenceDeclaration,
): DroppedPresence {
  const { sentence } = sentenceParts(dropped);
  const owner = ownerOf(screen);
  const pages = parityPages()
    .filter((page) => page.screen === screen)
    .filter((page) =>
      readFileSync(resolve(outputRoot, page.file), "utf8").includes(sentence),
    )
    .map((page) => page.id);
  return {
    pages,
    written: saysSentence(owner.files?.map(source).join("\n") ?? "", dropped),
    declared: declarationHolds(dropped),
  };
}

/** Whether a declaration's named constant still binds the expected sentence. */
export function declarationHolds(declaration: SentenceDeclaration): boolean {
  const { sentence, constant } = sentenceParts(declaration);
  return constant === undefined || holds(constant, sentence);
}

/** Whether one file still binds that name to exactly that sentence. */
function holds(
  constant: { file: string; name: string },
  sentence: string,
): boolean {
  if (!existsSync(resolve(repository, "apps/app/src", constant.file)))
    return false;
  const binding = new RegExp(
    "\\b" + escaped(constant.name) + '\\b\\s*=\\s*"' + escaped(sentence) + '"',
  );
  return binding.test(source(constant.file));
}
