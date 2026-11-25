/** Playwright flags that select tests by title, each with one value. */
const TITLE_FLAGS = new Set(["-g", "--grep", "-G", "--grep-invert"]);

/**
 * Return the arguments of a developer browser run that select its tests, so
 * that a Playwright list run finds the same specs. Return undefined when no
 * spec filter narrows the run, or when an argument is any other flag: such a
 * run builds every fixture, as a complete run does.
 */
export function browserSelectionArguments(args) {
  const selection = [];
  let filters = 0;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument.startsWith("-")) {
      selection.push(argument);
      filters += 1;
      continue;
    }
    const equals = argument.indexOf("=");
    const flag = equals === -1 ? argument : argument.slice(0, equals);
    if (!TITLE_FLAGS.has(flag)) return undefined;
    if (equals !== -1) selection.push(argument);
    else if (index + 1 < args.length) selection.push(argument, args[++index]);
    else return undefined;
  }
  return filters ? selection : undefined;
}
