export const RENDERING_PROTOCOL_PATH: "docs/protocol/mokly-rendering.md";
export function rendererContractSnippet(markdown: string): string;
export function installedRendererContract(
  consumerRoot: string,
): Promise<string>;
