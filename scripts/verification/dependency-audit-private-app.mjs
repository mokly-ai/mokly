import {
  DEPENDENCY_SCOPES,
  installPackageName,
  resolveDependency,
  workspaceLocations,
} from "./dependency-audit-lockfile.mjs";

const PRODUCTION_SCOPES = DEPENDENCY_SCOPES.filter(
  (scope) => scope !== "devDependencies",
);

function localLocation(packages, location) {
  return packages[location]?.link === true
    ? packages[location].resolved
    : location;
}

function productionReach(packages, start, target) {
  const pending = [start];
  const visited = new Set();
  while (pending.length) {
    const location = localLocation(packages, pending.pop());
    if (location === target) return true;
    if (visited.has(location)) continue;
    visited.add(location);
    const entry = packages[location];
    for (const scope of PRODUCTION_SCOPES)
      for (const name of Object.keys(entry?.[scope] ?? {})) {
        const resolved = resolveDependency(packages, location, name);
        if (resolved !== undefined) pending.push(resolved);
      }
  }
  return false;
}

/** Prove a private app path and exclude every published production closure. */
export function privateAppPathErrors(exception, nodes, packages, workspaces) {
  const errors = [];
  const locations = exception.path;
  const start = locations[0];
  const target = locations.at(-1);
  if (!nodes.includes(target))
    errors.push(
      `reported install locations ${nodes.join(", ")} differ from the reviewed path`,
    );
  if (!/^apps\/[^/]+$/u.test(start) || workspaces[start]?.private !== true)
    errors.push("private-app path must start at a private apps/ workspace");
  for (const location of locations)
    if (!packages[location]) errors.push(`path entry ${location} is missing`);
  for (let index = 1; index < locations.length; index++) {
    const owner = localLocation(packages, locations[index - 1]);
    const next = locations[index];
    const name = installPackageName(next);
    const entry = packages[owner];
    if (
      !DEPENDENCY_SCOPES.some((scope) =>
        Object.hasOwn(entry?.[scope] ?? {}, name),
      ) ||
      resolveDependency(packages, owner, name) !== next
    )
      errors.push(`no dependency edge from ${locations[index - 1]} to ${next}`);
  }
  for (const workspace of workspaceLocations(packages)) {
    if (!Object.hasOwn(workspaces, workspace))
      errors.push(`workspace manifest ${workspace} is missing`);
    else if (
      workspaces[workspace].private !== true &&
      productionReach(packages, workspace, target)
    )
      errors.push(
        `published workspace ${workspace} reaches ${target} through production dependencies`,
      );
  }
  return errors;
}
