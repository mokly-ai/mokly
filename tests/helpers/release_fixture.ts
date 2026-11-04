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
      "dist/browser.js",
      "dist/browser.d.ts",
      "dist/browser.manifest.json",
      "dist/data.js",
      "dist/data.d.ts",
      "dist/styles.css",
      "dist/shell.css",
      "dist/browser/frame-probe.js",
      "dist/browser/shell.js",
      "dist/assets/fonts/Inter-OFL.txt",
      "README.md",
      "CHANGELOG.md",
      "LICENSE",
      "package.json",
    ].map((path) => ({ path, size: 1 })),
  };
}

export function uiPackageReport(): PackageReport {
  return {
    integrity: `sha512-${"c".repeat(12)}`,
    shasum: "d".repeat(40),
    name: "@mokly/ui",
    version: "0.1.0",
    files: [
      "dist/styles.css",
      "dist/top-bar/top-bar.js",
      "dist/top-bar/top-bar.d.ts",
      "dist/top-bar/top-bar.css",
      "README.md",
      "CHANGELOG.md",
      "LICENSE",
      "package.json",
    ].map((path) => ({ path, size: 1 })),
  };
}

export function modelPackageReport(): PackageReport {
  return {
    integrity: `sha512-${"e".repeat(12)}`,
    shasum: "f".repeat(40),
    name: "@mokly/model",
    version: "0.18.0",
    files: [
      "dist/index.js",
      "dist/index.d.ts",
      "README.md",
      "CHANGELOG.md",
      "LICENSE",
      "package.json",
    ].map((path) => ({ path, size: 1 })),
  };
}

export function framePackageReport(): PackageReport {
  return {
    integrity: `sha512-${"g".repeat(12)}`,
    shasum: "a".repeat(40),
    name: "@mokly/frame",
    version: "0.18.0",
    files: [
      "dist/index.js",
      "dist/index.d.ts",
      "dist/internal.js",
      "dist/internal.d.ts",
      "dist/browser/frame-probe.js",
      "README.md",
      "CHANGELOG.md",
      "LICENSE",
      "package.json",
    ].map((path) => ({ path, size: 1 })),
  };
}
