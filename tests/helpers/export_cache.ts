import { parse } from "@babel/parser";

export function parserProbe() {
  const calls: { source: string; plugins: unknown }[] = [];
  const parser: typeof parse = (source, options) => {
    calls.push({ source, plugins: options?.plugins });
    return parse(source, options);
  };
  return { calls, parser };
}
