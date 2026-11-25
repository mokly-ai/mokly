/**
 * The package steps of `npm run build`. Each step lists the repository paths
 * that its build reads, the paths that it writes, its manifest, and the
 * earlier steps whose outputs it reads. A step also reads the outputs and the
 * manifests of the steps that those steps read. `declarations` limits a read
 * to the `.d.ts` files of the earlier step and of the steps behind it: the
 * TypeScript compiler of the later step reads only those, so a change to
 * emitted JavaScript alone does not rebuild it.
 */

/** Entries of a package directory that no package build reads. */
const NOT_BUILD_INPUTS = ["dist", "node_modules", "tests"];

/** Inputs of every step: the installed dependencies and the shared config. */
export const SHARED_INPUTS = [
  { path: "package.json" },
  { path: "package-lock.json" },
  { path: "node_modules/.package-lock.json" },
  { path: "tsconfig.json" },
  { path: "scripts/build", exclude: ["README.md"] },
];

export const PACKAGE_STEPS = [
  packageStep("@mokly/ui", "packages/ui", []),
  packageStep("@mokly/model", "packages/model", []),
  packageStep("@mokly/frame", "packages/frame", [{ step: "@mokly/model" }]),
  packageStep("@mokly/viewer", "packages/viewer", [
    { step: "@mokly/ui" },
    { step: "@mokly/model" },
    { step: "@mokly/frame" },
  ]),
  {
    name: "@mokly/mokly",
    inputs: [
      {
        path: "packages/mokly",
        exclude: [...NOT_BUILD_INPUTS, "docs", "CHANGELOG.md"],
      },
      { path: "docs/guides" },
      { path: "docs/protocol", exclude: ["cloud"] },
      { path: "CHANGELOG.md" },
    ],
    outputs: [
      { path: "packages/mokly/dist" },
      { path: "packages/mokly/docs" },
      { path: "packages/mokly/CHANGELOG.md" },
    ],
    manifest: "packages/mokly/package.json",
    after: [{ step: "@mokly/viewer", declarations: true }],
  },
];

function packageStep(name, directory, after) {
  return {
    name,
    inputs: [{ path: directory, exclude: NOT_BUILD_INPUTS }],
    outputs: [{ path: `${directory}/dist` }],
    manifest: `${directory}/package.json`,
    after,
  };
}
