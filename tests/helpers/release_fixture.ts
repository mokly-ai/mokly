/** Minimal packed inventory shared by release guard and propagation tests. */
export interface PackageReport {
  files: Array<{ path: string; size: number }>;
  integrity: string;
  name: string;
  shasum: string;
  version: string;
}

export function viewerPackageReport(): PackageReport {
  return {
    integrity: `sha512-${"a".repeat(12)}`,
    shasum: "b".repeat(40),
    name: "@mokly/viewer",
    version: "0.1.0",
    files: [
      "dist/index.js",
      "dist/index.d.ts",
      "dist/server.js",
      "dist/server.d.ts",
      "dist/runtime.js",
      "dist/runtime.d.ts",
      "dist/browser.js",
      "dist/browser.d.ts",
      "dist/browser.manifest.json",
      "dist/data.js",
      "dist/data.d.ts",
      "dist/styles.css",
      "dist/browser/inspector.js",
      "dist/browser/react-shell.js",
      "dist/assets/fonts/Inter-OFL.txt",
      "README.md",
      "CHANGELOG.md",
      "LICENSE",
      "package.json",
    ].map((path) => ({ path, size: 1 })),
  };
}
