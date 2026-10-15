/** The five platform packages in one coordinated CLI release. */
export const NATIVE_TARGETS = [
  {
    target: "linux-x64-gnu",
    triple: "x86_64-unknown-linux-gnu",
    os: "linux",
    cpu: "x64",
    libc: "glibc",
  },
  {
    target: "linux-arm64-gnu",
    triple: "aarch64-unknown-linux-gnu",
    os: "linux",
    cpu: "arm64",
    libc: "glibc",
  },
  {
    target: "darwin-x64",
    triple: "x86_64-apple-darwin",
    os: "darwin",
    cpu: "x64",
  },
  {
    target: "darwin-arm64",
    triple: "aarch64-apple-darwin",
    os: "darwin",
    cpu: "arm64",
  },
  {
    target: "win32-x64-msvc",
    triple: "x86_64-pc-windows-msvc",
    os: "win32",
    cpu: "x64",
  },
].map((value) => ({
  ...value,
  name: `@mokly/native-${value.target}`,
  directory: `packages/native-${value.target}`,
  executable: value.os === "win32" ? "mokly.exe" : "mokly",
}));

export function nativeTarget(target) {
  const value = NATIVE_TARGETS.find(
    (value) => value.target === target || value.name === target,
  );
  if (!value) throw new Error(`unknown native target: ${target}`);
  return value;
}

export function releasePackages() {
  return [
    ...NATIVE_TARGETS.map((value) => ({
      ...value,
      artifact: `native-${value.target}`,
    })),
    { name: "@mokly/viewer", directory: "packages/viewer", artifact: "viewer" },
    { name: "@mokly/mokly", directory: "packages/mokly", artifact: "mokly" },
  ];
}
