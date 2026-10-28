/** A package specifier: not relative, absolute, a subpath import, or a URL. */
export function bareSpecifier(name: string): boolean {
  return !/^(\.|\/|#|[a-z]+:)/i.test(name);
}

/** The package that a bare specifier names: `name`, or `@scope/name`. */
export function packageName(specifier: string): string {
  return specifier
    .split("/")
    .slice(0, specifier.startsWith("@") ? 2 : 1)
    .join("/");
}
