/**
 * The installers of the download page: two section boxes on the canvas, as
 * the pricing page groups its plans. Mac holds the Apple silicon and Intel
 * frames, and Linux holds the AppImage and Debian and Ubuntu frames. Each
 * frame is labelled with the file that it downloads, names the computer and
 * holds one Download action, which opens GitHub's fixed address of that
 * file in the latest release. No frame is selected: the page does not know
 * the reader's computer, so it marks no installer as the one to take.
 */

import {
  desktopDownload,
  desktopInstallers,
  type DesktopInstaller,
} from "../../../../fixtures/site";

import { SiteFrameLabel } from "./frame-label.js";
import { SiteIcon } from "./icons.js";
import { SiteSectionBox } from "./labels.js";

/** One installer: its file and the computer that it runs on. */
interface Installer {
  readonly file: DesktopInstaller;
  readonly id: string;
  readonly name: string;
}

/** One system's section box: its name and its installers. */
interface InstallerGroup {
  readonly id: string;
  readonly installers: readonly Installer[];
  readonly name: string;
}

/**
 * The installers in the page's order. Apple silicon comes first, because
 * new Macs use it.
 */
const GROUPS: readonly InstallerGroup[] = [
  {
    id: "mac",
    installers: [
      {
        file: desktopInstallers.macAppleSilicon,
        id: "mac-arm64",
        name: "Apple silicon",
      },
      { file: desktopInstallers.macIntel, id: "mac-x64", name: "Intel" },
    ],
    name: "Mac",
  },
  {
    id: "linux",
    installers: [
      {
        file: desktopInstallers.linuxAppImage,
        id: "linux-appimage",
        name: "AppImage",
      },
      {
        file: desktopInstallers.linuxDeb,
        id: "linux-deb",
        name: "Debian and Ubuntu",
      },
    ],
    name: "Linux",
  },
];

/**
 * One installer frame: the file as its label, the computer as its heading
 * and the Download action. The action's hidden words name the system and
 * the computer, so each of the four actions reads apart from the others.
 */
function InstallerFrame({
  installer,
  system,
}: {
  installer: Installer;
  system: string;
}) {
  const heading = `download-${installer.id}`;
  return (
    <article aria-labelledby={heading} className="site-download-installer">
      <SiteFrameLabel icon="file" name={installer.file} />
      <h2 className="site-download-name" id={heading}>
        {installer.name}
      </h2>
      <a
        className="site-button site-button--secondary"
        href={desktopDownload(installer.file)}
      >
        <SiteIcon name="download" />
        Download
        <span className="site-visually-hidden">
          {` for ${system}, ${installer.name}`}
        </span>
      </a>
    </article>
  );
}

/** The installers: the Mac box and the Linux box, each with two frames. */
export function DownloadInstallers() {
  return (
    <div className="site-download-installers">
      {GROUPS.map((group) => (
        <SiteSectionBox
          key={group.id}
          tag={group.name}
          tagId={`download-box-${group.id}`}
        >
          {group.installers.map((installer) => (
            <InstallerFrame
              installer={installer}
              key={installer.id}
              system={group.name}
            />
          ))}
        </SiteSectionBox>
      ))}
    </div>
  );
}
