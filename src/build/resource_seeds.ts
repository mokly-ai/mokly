/** An explicit closure seed retains its referring document for diagnostics. */
export interface ResourceSeed {
  path: string;
  sourceRoute: string;
}

/** Bind bare seeds to the first document while keeping explicit origins. */
export function resourceSeedOrigins(
  seeds: readonly (string | ResourceSeed)[],
  firstDocument: string | undefined,
): Map<string, string> {
  return new Map(
    seeds.map((seed) =>
      typeof seed === "string"
        ? [seed, firstDocument ?? seed]
        : [seed.path, seed.sourceRoute],
    ),
  );
}
