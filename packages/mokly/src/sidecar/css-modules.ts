/** Virtual imports expose named classes without CommonJS default interop. */
export const cssModulePrefix = "mokly:css-map:";

/** Keep the default map intact; only identifier keys become named exports. */
export function namedClasses(
  map: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(map).filter(
      ([name]) =>
        /^[$_\p{ID_Start}](?:[$_\p{ID_Continue}]|\u200c|\u200d)*$/u.test(
          name,
        ) && !reserved.has(name),
    ),
  );
}

const reserved = new Set(
  "await break case catch class const continue debugger default delete do else enum export extends false finally for function if implements import in instanceof interface let new null package private protected public return static super switch this throw true try typeof var void while with yield".split(
    " ",
  ),
);
