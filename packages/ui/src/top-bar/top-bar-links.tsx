/**
 * The top bar's brand, which starts the bar: a control of the shell, a link
 * to an address that a static depiction gives, or a picture of itself in a
 * depiction that runs no script. The bar has no menu: the dock's Catalogue
 * opens the catalogue's sheet.
 */

import { BrandIcon } from "./brand-icon.js";

/**
 * The brand, as a link or a picture: the mark, and the wordmark `mokly.`
 * unless the bar draws the mark alone. The wordmark's period is its own
 * element so that it takes the brand colour.
 */
export function Brand({
  href,
  wordmark,
}: {
  href: string | undefined;
  wordmark: boolean;
}) {
  const content = (
    <>
      <span aria-hidden="true" className="mbk-mark mbk-reset">
        <BrandIcon />
      </span>
      {wordmark ? (
        <span className="mbk-name mbk-reset">
          mokly<span className="mbk-name-dot mbk-reset">.</span>
        </span>
      ) : null}
    </>
  );
  if (href === undefined)
    return (
      <span aria-label="Mokly" className="mbk-brand mbk-reset" role="img">
        {content}
      </span>
    );
  return (
    <a aria-label="Mokly" className="mbk-brand mbk-reset" href={href}>
      {content}
    </a>
  );
}
