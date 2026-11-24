/**
 * The location trail, set as the eyebrow line above a page title. The
 * documentation and the changelog share it.
 */

/** The trail of section names, from the outermost to the page's own. */
export function SiteTrail({ trail }: { trail: readonly string[] }) {
  return (
    <nav aria-label="Location" className="site-trail">
      {trail.map((step, index) => (
        <span className="site-trail-step" key={step}>
          {index > 0 ? (
            <span aria-hidden="true" className="site-trail-sep">
              &#8250;
            </span>
          ) : null}
          {step}
        </span>
      ))}
    </nav>
  );
}
