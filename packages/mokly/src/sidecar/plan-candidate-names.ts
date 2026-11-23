export const fixedNames = [
  "node_modules",
  "package.json",
  "tsconfig.json",
  "jsconfig.json",
  ".pnp.data.json",
  ".pnp.cjs",
  ".pnp.js",
].map((name) => ({ name, bytes: Buffer.byteLength(JSON.stringify(name)) + 1 }));

/** Allow six JSON bytes per code unit, two quotes, and one container byte. */
export function nameChargeBound(length: number): number {
  return 3 + 6 * length;
}

export function blocksDirectory(name: string): boolean {
  for (let index = 0; index < name.length; index++) {
    const unit = name.charCodeAt(index);
    if (unit >= 128 || unit === 47 || unit === 92) return true;
  }
  return false;
}
