/**
 * The Git environment of the mockup tests. A Git hook that runs the tests
 * sets variables such as `GIT_DIR` and `GIT_INDEX_FILE`, which would point the
 * tests' Git at the hook's repository and index. A developer's global or
 * system Git configuration, such as `commit.gpgsign`, would change a fixture.
 */

/** Whether an environment variable belongs to Git, matched without case. */
export function isGitVariable(/** @type {string} */ name) {
  return name.toUpperCase().startsWith("GIT_");
}

/**
 * The environment of every process that a test runs in a fixture checkout:
 * no inherited Git variable, and neither the global nor the system Git
 * configuration.
 */
export function fixtureGitEnvironment(
  /** @type {Record<string, string | undefined>} */ environment = process.env,
) {
  return {
    ...Object.fromEntries(
      Object.entries(environment).filter(([name]) => !isGitVariable(name)),
    ),
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
  };
}
