/** Byte-safe operations on compiled text documents and opaque generated assets. */

import { MoklyError } from "../errors.js";

/** A generated document remains text; font and image assets retain their raw bytes. */
export type GeneratedFile = string | Uint8Array;

/** Obtain raw bytes without interpreting a binary asset as UTF-8. */
export function generatedBytes(content: GeneratedFile): Buffer {
  return Buffer.from(content);
}

/** Count physical output bytes, not the number of JavaScript code units. */
export function generatedByteLength(content: GeneratedFile): number {
  return typeof content === "string"
    ? Buffer.byteLength(content)
    : content.byteLength;
}

/** Compare an expected output with a captured file without decoding the file. */
export function generatedMatchesBytes(
  expected: GeneratedFile,
  actual: Uint8Array,
): boolean {
  return generatedBytes(expected).equals(actual);
}

/** Read a generated HTML/manifest document only when it really is text. */
export function generatedText(
  content: GeneratedFile | undefined,
  route: string,
): string | undefined {
  if (content === undefined || typeof content === "string") return content;
  throw new MoklyError(
    "build-invalid",
    `generated document is not text: ${route}`,
  );
}

/** JSON-safe representation of a generated file crossing process IPC. */
export type TransferredGeneratedFile =
  string | { readonly kind: "bytes"; readonly base64: string };

/** Carry binary output across a JSON IPC channel without UTF-8 conversion. */
export function transferGeneratedFile(
  content: GeneratedFile,
): TransferredGeneratedFile {
  return typeof content === "string"
    ? content
    : { kind: "bytes", base64: generatedBytes(content).toString("base64") };
}

/** Recover binary output after validating the JSON IPC representation. */
export function receiveGeneratedFile(
  content: unknown,
): GeneratedFile | undefined {
  if (typeof content === "string") return content;
  if (
    !content ||
    typeof content !== "object" ||
    !("kind" in content) ||
    content.kind !== "bytes" ||
    !("base64" in content) ||
    typeof content.base64 !== "string" ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      content.base64,
    )
  )
    return undefined;
  return Buffer.from(content.base64, "base64");
}
