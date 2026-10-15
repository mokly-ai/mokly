const name = "./child.cjs";
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Exercise the CommonJS module context.
const child = require(name);
export = { file: child.file };
