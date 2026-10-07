import fs from "node:fs/promises";
import path from "node:path";

/** Package-relative rendering protocol that holds the renderer contract. */
export const RENDERING_PROTOCOL_PATH = "docs/protocol/mokly-rendering.md";

/** Extract the renderer declaration block that packed consumers must type-check. */
export function rendererContractSnippet(markdown) {
  const match =
    /The renderer module has one default synchronous export with this exact\s+contract:\s*```ts\r?\n([\s\S]*?)\r?\n```/.exec(
      markdown,
    );
  if (!match?.[1])
    throw new Error(
      "Rendering protocol is missing the renderer TypeScript block",
    );
  return match[1];
}

/** Read the contract that the consumer's installed package ships, not this checkout's copy. */
export async function installedRendererContract(consumerRoot) {
  const markdown = await fs.readFile(
    path.join(
      consumerRoot,
      "node_modules/@mokly/mokly",
      RENDERING_PROTOCOL_PATH,
    ),
    "utf8",
  );
  return rendererContractSnippet(markdown);
}
