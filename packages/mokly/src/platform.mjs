/** Select one supported native package without a JavaScript fallback. */
export function platformPackage(platform, architecture, glibc) {
  const suffix = {
    "linux:x64": "linux-x64-gnu",
    "linux:arm64": "linux-arm64-gnu",
    "darwin:x64": "darwin-x64",
    "darwin:arm64": "darwin-arm64",
    "win32:x64": "win32-x64-msvc",
  }[`${platform}:${architecture}`];
  if (!suffix || (platform === "linux" && !glibc)) {
    throw new Error(
      `Mokly has no native binary for ${platform}/${architecture}${platform === "linux" && !glibc ? " without glibc" : ""}. Use a supported platform from @mokly/mokly's package documentation.`,
    );
  }
  return `@mokly/native-${suffix}`;
}
