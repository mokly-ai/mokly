import { MoklyError } from "../errors.js";

/** Require a literal, confined path before constructing a Git object specifier. */
export function assertGitPath(value: string): void {
  if (
    value === "" ||
    value.startsWith("/") ||
    value.includes("\\") ||
    value
      .split("/")
      .some((part) => part === "" || part === "." || part === "..") ||
    value.includes(":")
  ) {
    throw new MoklyError("git-failed", `unsafe Git path: ${value}`);
  }
}
