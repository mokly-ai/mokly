import assert from "node:assert/strict";

/** Prove the HTTP-served export carries the hydrated shell marker. */
export async function assertServedShellMarker(
  origin: string,
  pathname: string,
): Promise<void> {
  const response = await fetch(new URL(pathname, origin));
  assert.equal(
    response.status,
    200,
    `could not read exported shell ${pathname}`,
  );
  const html = await response.text();
  assert.ok(
    html.includes('data-mokly-react-shell=""'),
    `${pathname} did not serve the hydrated shell`,
  );
}
