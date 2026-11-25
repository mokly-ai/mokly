/** Shared production origin for the public-site and application fixtures. */
export const siteOrigin = "https://mokly.ai";

/** Outbound destinations owned by the public site, never catalogue entries. */
export const site = {
  home: siteOrigin + "/",
  docs: siteOrigin + "/docs/",
  /** The CI setup guide, which the installed package's guides publish. */
  publishFromCi: siteOrigin + "/docs/ci/publish-from-ci/",
  pricing: siteOrigin + "/pricing",
  changelog: siteOrigin + "/changelog/",
  terms: siteOrigin + "/terms",
  privacy: siteOrigin + "/privacy",
} as const;

/** Outbound destinations owned by the application, never site catalogue entries. */
export const app = {
  signIn: siteOrigin + "/sign-in",
  signUp: siteOrigin + "/sign-up",
} as const;

/** The public GitHub repository linked from every site header. */
export const openSource = {
  github: "https://github.com/mokly-ai/mokly",
} as const;

/**
 * The desktop app's installers, which every desktop release publishes under
 * these names. A name holds no version, and every release becomes the
 * latest release, so an installer's download address never changes.
 */
export const desktopInstallers = {
  macAppleSilicon: "Mokly-mac-arm64.dmg",
  macIntel: "Mokly-mac-x64.dmg",
  linuxAppImage: "Mokly-linux-x86_64.AppImage",
  linuxDeb: "Mokly-linux-amd64.deb",
} as const;

/** One installer of the desktop app, by its file name. */
export type DesktopInstaller =
  (typeof desktopInstallers)[keyof typeof desktopInstallers];

/** GitHub's fixed download address of an installer in the latest release. */
export function desktopDownload(installer: DesktopInstaller): string {
  return `https://github.com/mokly-ai/mokly-desktop/releases/latest/download/${installer}`;
}
