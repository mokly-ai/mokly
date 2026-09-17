/** Minimal packed inventory shared by release guard and propagation tests. */
export interface PackageReport {
  files: Array<{ path: string; size: number }>;
  integrity: string;
  name: string;
  shasum: string;
  version: string;
}

export function packageReport(): PackageReport {
  return {
    files: [
      { path: "dist/index.js", size: 1 },
      { path: "dist/index.d.ts", size: 1 },
      { path: "dist/cli/bin.js", size: 1 },
      { path: "dist/cli/export.js", size: 1 },
      { path: "dist/cli/publish.js", size: 1 },
      { path: "dist/publish/run.js", size: 1 },
      { path: "docs/protocol/mokly-upload.md", size: 1 },
      { path: "docs/protocol/mokly-export-ownership.md", size: 1 },
      { path: "docs/protocol/fixtures/export-ownership-v1.json", size: 1 },
      { path: "docs/protocol/mokly-catalogue.md", size: 1 },
      { path: "docs/protocol/fixtures/catalogue-v1.json", size: 1 },
      { path: "dist/catalogue/projection.js", size: 1 },
      { path: "dist/export/run.js", size: 1 },
      { path: "dist/export/transaction.js", size: 1 },
      { path: "dist/components/definition.js", size: 1 },
      { path: "dist/server/controls/worker.js", size: 1 },
      { path: "docs/protocol/mokly-frame-adapter.md", size: 1 },
      { path: "README.md", size: 1 },
      { path: "LICENSE", size: 1 },
      { path: "CHANGELOG.md", size: 1 },
      { path: "package.json", size: 1 },
    ],
    integrity: `sha512-${"a".repeat(12)}`,
    name: "@mokly/mokly",
    shasum: "b".repeat(40),
    version: "1.2.3",
  };
}

export function viewerPackageReport(): PackageReport {
  return {
    ...packageReport(),
    name: "@mokly/viewer",
    version: "0.1.0",
    files: [
      "dist/index.js",
      "dist/index.d.ts",
      "dist/server.js",
      "dist/server.d.ts",
      "dist/runtime.js",
      "dist/runtime.d.ts",
      "dist/data.js",
      "dist/data.d.ts",
      "dist/styles.css",
      "dist/browser/inspector.js",
      "dist/assets/fonts/Inter-OFL.txt",
      "README.md",
      "CHANGELOG.md",
      "LICENSE",
      "package.json",
    ].map((path) => ({ path, size: 1 })),
  };
}
