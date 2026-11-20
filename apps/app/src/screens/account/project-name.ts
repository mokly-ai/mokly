/**
 * The most characters a project's display name may have. The API states it on
 * the `name` of each project create shape in `docs/api/openapi.json`, and the
 * helper's test holds this value to that document.
 */
export const projectNameLimit = 80;

/** What a cut can leave at the end of a name: spaces and name separators. */
const trailingSeparators = /[\s._-]+$/u;

/**
 * The name a new project starts with: the repository's own name, its last
 * segment, whether the repository is an installed `owner/name` or an identity
 * the Mokly CLI names on any host. A trailing `.git` is how a clone address
 * spells the repository, not part of its name.
 *
 * A repository name can be longer than a display name, so a longer one is cut
 * to the limit. Only the name is cut: the repository identity a form sends
 * stays whole, because every later upload must match it.
 */
export function projectName(repository: string): string {
  const segments = repository.trim().split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? repository.trim();
  const name = last.replace(/\.git$/i, "");
  return withinLimit(name.length > 0 ? name : last);
}

/**
 * One name cut to the display name limit. The API counts characters, not
 * UTF-16 units, so the cut never splits one. It drops the spaces and
 * separators it leaves at the end, unless they are all the name has.
 */
function withinLimit(name: string): string {
  const characters = Array.from(name);
  if (characters.length <= projectNameLimit) return name;
  const cut = characters.slice(0, projectNameLimit).join("");
  const trimmed = cut.replace(trailingSeparators, "");
  return trimmed.length > 0 ? trimmed : cut;
}
