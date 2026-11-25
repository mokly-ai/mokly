/**
 * The package steps of `npm run build`. Each step lists the repository paths
 * that its build reads, the paths that it writes, and the earlier steps whose
 * outputs it reads. `declarations` limits that read to the `.d.ts` files of
 * the earlier step: the TypeScript compiler of the later step reads only
 * those, so a change to emitted JavaScript alone does not rebuild it.
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
      // The package exports of the viewer decide which declarations resolve.
      { path: "packages/viewer/package.json" },
      { path: "docs/guides" },
      { path: "docs/protocol", exclude: ["cloud"] },
      { path: "CHANGELOG.md" },
    ],
    outputs: [
      { path: "packages/mokly/dist" },
      { path: "packages/mokly/docs" },
      { path: "packages/mokly/CHANGELOG.md" },
    ],
    after: [{ step: "@mokly/viewer", declarations: true }],
  },
];

function packageStep(name, directory, after) {
  return {
    name,
    inputs: [{ path: directory, exclude: NOT_BUILD_INPUTS }],
    outputs: [{ path: `${directory}/dist` }],
    after,
  };
}
