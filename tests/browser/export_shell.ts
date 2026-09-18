import assert from "node:assert/strict";

/** Select the private shell export mode owned by one Playwright project. */
export function reactShellForProject(projectName: string): boolean {
  return projectName === "react-shell";
}

/** Prove the HTTP-served export matches the project that requested it. */
export async function assertServedShellMarker(
  origin: string,
  pathname: string,
  reactShell: boolean,
): Promise<void> {
  const response = await fetch(new URL(pathname, origin));
  assert.equal(
    response.status,
    200,
    `could not read exported shell ${pathname}`,
  );
  const html = await response.text();
  assert.equal(
    html.includes('data-mokly-react-shell=""'),
    reactShell,
    `${pathname} served the wrong shell for ${reactShell ? "react-shell" : "chromium"}`,
  );
}
