import path from "node:path";

/** Normalize a repository module path to its Git representation. */
export function normalizeModulePath(file) {
  return file.replaceAll("\\", "/").replace(/^\.\//u, "");
}

/** Create the package-aware relative resolver used by the export graph. */
export function createModuleResolver(records, aliases) {
  return (from, specifier) => {
    const alias = aliases[specifier];
    if (alias && records.has(normalizeModulePath(alias)))
      return normalizeModulePath(alias);
    return resolveRelativeModule(from, specifier, (file) => records.has(file));
  };
}

/** Resolve one relative specifier with the workspace module candidates. */
export function resolveRelativeModule(from, specifier, fileExists) {
  if (typeof specifier !== "string" || !specifier.startsWith("."))
    return undefined;
  const relative = normalizeModulePath(
    path.posix.join(path.posix.dirname(from), specifier),
  );
  for (const candidate of moduleCandidates(relative))
    if (fileExists(candidate)) return candidate;
  const remapped = relative.replace(/(^|\/)dist\//u, "$1src/");
  if (remapped !== relative)
    for (const candidate of moduleCandidates(remapped))
      if (fileExists(candidate)) return candidate;
  return undefined;
}

function moduleCandidates(file) {
  const extension = path.posix.extname(file);
  const stem = /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)$/u.test(extension)
    ? file.slice(0, -extension.length)
    : file;
  return [
    file,
    `${stem}.ts`,
    `${stem}.tsx`,
    `${stem}.mts`,
    `${stem}.cts`,
    `${stem}.js`,
    `${stem}.jsx`,
    `${stem}.mjs`,
    `${stem}.cjs`,
    `${stem}/index.ts`,
    `${stem}/index.tsx`,
    `${stem}/index.mts`,
    `${stem}/index.cts`,
    `${stem}/index.js`,
    `${stem}/index.mjs`,
    `${stem}/index.cjs`,
  ];
}
