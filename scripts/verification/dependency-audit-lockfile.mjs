import path from "node:path";

/** Return whether a JSON value is an object, rather than an array or null. */
export function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Accept normalized npm package names, including scoped names. */
export function isPackageName(value) {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u.test(value)
  );
}

function installPackageName(location) {
  return location.match(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)$/u)?.[1];
}

/** Accept canonical relative lockfile install locations. */
export function isInstallLocation(value) {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value
      .split("/")
      .every(
        (segment) =>
          /^[a-zA-Z0-9_@.-]+$/u.test(segment) &&
          segment !== "." &&
          segment !== "..",
      ) &&
    isPackageName(installPackageName(value))
  );
}

const DEPENDENCY_SCOPES = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

/** Reject missing package inventories and malformed dependency maps. */
export function lockfileErrors(lockfile) {
  if (
    !isRecord(lockfile) ||
    !isRecord(lockfile.packages) ||
    !isRecord(lockfile.packages[""])
  )
    return [
      "Invalid package-lock.json: missing packages or root entry. Restore the npm lockfile and retry.",
    ];
  const errors = [];
  for (const [location, entry] of Object.entries(lockfile.packages)) {
    if (
      location !== "" &&
      (path.posix.isAbsolute(location) ||
        path.posix.normalize(location) !== location ||
        location.includes("\\") ||
        location.includes("\0") ||
        location
          .split("/")
          .some(
            (segment) => segment === "" || segment === "." || segment === "..",
          ))
    ) {
      errors.push(
        `Invalid lockfile location ${location}. Restore normalized relative locations with npm.`,
      );
      continue;
    }
    if (!isRecord(entry)) {
      errors.push(
        `Invalid lockfile entry ${location || "(root)"}. Regenerate package-lock.json with npm.`,
      );
      continue;
    }
    for (const scope of DEPENDENCY_SCOPES) {
      if (entry[scope] === undefined) continue;
      if (
        !isRecord(entry[scope]) ||
        Object.entries(entry[scope]).some(
          ([name, range]) =>
            !isPackageName(name) ||
            typeof range !== "string" ||
            range.trim() === "",
        )
      )
        errors.push(
          `Invalid ${scope} at ${location || "(root)"}. Regenerate package-lock.json with npm.`,
        );
    }
  }
  return errors;
}

function resolveDependency(packages, owner, name) {
  let directory = owner;
  while (true) {
    if (path.posix.basename(directory) !== "node_modules") {
      const candidate = path.posix.join(directory, "node_modules", name);
      if (Object.hasOwn(packages, candidate)) return candidate;
    }
    if (directory === "") return undefined;
    const parent = path.posix.dirname(directory);
    directory = parent === "." ? "" : parent;
  }
}

/** Prove the exact dev-only path and every inner package's sole dependent. */
export function exceptionPathErrors(exception, nodes, packages) {
  const errors = [];
  const locations = exception.path;
  if (nodes.length !== 1 || nodes[0] !== locations.at(-1))
    errors.push(
      `reported install locations ${nodes.join(", ")} differ from the reviewed path`,
    );
  for (const location of locations) {
    const entry = packages[location];
    if (!entry) errors.push(`path entry ${location} is missing`);
    else if (entry.dev !== true || entry.devOptional === true)
      errors.push(`path entry ${location} is production, not dev-only`);
  }
  for (let index = 1; index < locations.length; index++) {
    const target = locations[index];
    const name = installPackageName(target);
    const dependents = new Set();
    for (const [owner, entry] of Object.entries(packages)) {
      if (
        DEPENDENCY_SCOPES.some((scope) =>
          Object.hasOwn(entry[scope] ?? {}, name),
        ) &&
        resolveDependency(packages, owner, name) === target
      )
        dependents.add(owner);
    }
    if (dependents.size !== 1 || !dependents.has(locations[index - 1]))
      errors.push(
        `path entry ${target} must have only dependent ${locations[index - 1]}; found ${[...dependents].map((owner) => owner || "(root)").join(", ") || "none"}`,
      );
  }
  return errors;
}
