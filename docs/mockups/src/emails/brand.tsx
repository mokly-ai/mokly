import { logoHeight, logoWidth } from "./styles";
import type { EmailStyleTable } from "./styles";

/** The published logo, one lockup for each scheme, drawn as the brand. */
export const logoFiles = {
  dark: "mokly-logo-dark.png",
  light: "mokly-logo-light.png",
} as const;

/**
 * The brand: the published logo, mark and wordmark as one artwork. Mail
 * clients strip inline SVG and substitute their own serif for a text
 * wordmark, so the lockup is an image; both scheme variants are sent and the
 * style table shows one of them, and a client that blocks images shows the
 * product's name in its place. The images carry `fetchPriority="low"`
 * because React hoists a preload `link` above an image without it, and the
 * document carries no `link` at all.
 */
export function BrandRow({
  brandRoot,
  styles,
}: {
  brandRoot: string;
  styles: EmailStyleTable;
}) {
  return (
    <tr>
      <td className="e-logo" style={styles["e-logo"]}>
        <img
          alt="Mokly"
          className="e-logo-light"
          fetchPriority="low"
          height={logoHeight}
          src={brandRoot + logoFiles.light}
          style={styles["e-logo-light"]}
          width={logoWidth}
        />
        <img
          alt="Mokly"
          className="e-logo-dark"
          fetchPriority="low"
          height={logoHeight}
          src={brandRoot + logoFiles.dark}
          style={styles["e-logo-dark"]}
          width={logoWidth}
        />
      </td>
    </tr>
  );
}
