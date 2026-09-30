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
