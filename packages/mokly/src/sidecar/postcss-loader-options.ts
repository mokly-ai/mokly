const options = [...process.execArgv, process.env.NODE_OPTIONS ?? ""];

export const asynchronousLoader = options.some((value) =>
  /--(?:experimental-)?loader(?:=|\s|$)/.test(value),
);

export const preloadedCode = options.some((value) =>
  /--(?:import|loader|experimental-loader|require)|(?:^|[\s"'])-r/.test(value),
);

// These releases accept a null CommonJS source from an asynchronous loader.
// See nodejs/node#57327.
const [major, minor = 0] = process.versions.node.split(".").map(Number);
export const mixedLoadHooksSupported =
  (major !== 22 || minor >= 23) && (major !== 24 || minor >= 12);
