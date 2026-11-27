import { execFileSync } from "node:child_process";

import { databaseUrl } from "./database";

/**
 * Write one provider observation the API has no endpoint to create. Retained
 * GitHub rows arrive through webhooks and reconciliation, so a browser test
 * that needs one puts it where those would, exactly as the integration smokes
 * do; nothing the reader sees is invented, because the API reads it back.
 */
export function sql(statement: string): void {
  execFileSync(
    "psql",
    [databaseUrl, "-v", "ON_ERROR_STOP=1", "-c", statement],
    { stdio: "pipe", timeout: 30_000 },
  );
}

/**
 * Put a workspace on Team, which a project must belong to before it can be
 * private. Only the billing webhook worker writes the plan, and no browser test
 * can drive it, so the row is written where that worker would write it; every
 * gated write reads it back inside its own transaction.
 */
export function upgradeToTeam(workspaceId: string): void {
  sql(`UPDATE organizations SET plan = 'team' WHERE id = '${workspaceId}'`);
}

/** Return a fixture-owned workspace to the free plan after a private setup. */
export function downgradeToFree(workspaceId: string): void {
  sql(`UPDATE organizations SET plan = 'free' WHERE id = '${workspaceId}'`);
}

/** Where the recorded installation is managed, as its own answer reports it. */
export const manageUrl = "https://github.com/settings/installations/1";

/** The one repository the recorded installation grants access to. */
export const installedRepository = "octocat/Hello-World";

/** The account the recorded installation sits on. */
export const installedAccount = "octocat";

/** The provider identifier the first recorded installation's answers carry. */
const recordedInstallation = 1;

/** The provider identifier the recorded authorizing user answers with. */
const recordedUser = 1;

/**
 * The second installation the recorded GitHub serves on request: the GitHub
 * organization `fixture-org`, which the recorded person administers, with one
 * repository of its own.
 */
export const secondInstallation = {
  id: 2,
  account: "fixture-org",
  repository: "fixture-org/Catalogue",
} as const;

/**
 * Start a release transaction that its caller commits after cleanup.
 *
 * The rows that hold a repository go first: a project keeps the repository
 * name it was created for, so what it loses is its link, the check runs its
 * publications posted and the builds it queued, which a later test would
 * otherwise see its pull requests, branches and checks through.
 */
function forgetInstallation(provider: number): string {
  const repositories = `
    SELECT repositories.id FROM github_repositories repositories
    JOIN github_installations installations
      ON installations.id = repositories.installation_id
    WHERE installations.github_id = ${provider}`;
  return `
    BEGIN;
    LOCK TABLE github_check_runs, builds IN SHARE ROW EXCLUSIVE MODE;
    DELETE FROM github_check_runs WHERE repository_id IN (${repositories});
    DELETE FROM builds WHERE repository_id IN (${repositories});
    DELETE FROM github_project_repositories
    WHERE repository_id IN (${repositories});
    DELETE FROM integrations
    WHERE provider = 'github' AND subject_kind = 'organization'
      AND subject_id IN (SELECT organization_id FROM github_installations
                         WHERE github_id = ${provider}
                           AND organization_id IS NOT NULL);
    DELETE FROM github_installations WHERE github_id = ${provider};
  `;
}

/**
 * Hand the recorded App installation and the recorded GitHub person back.
 *
 * The recordings describe a first installation on one account, authorized by
 * one person, and the suite replays them for every account it signs in. GitHub
 * refuses a second workspace the installation another one is still bound to,
 * and refuses an identity another account still holds, so a walk that is about
 * to install starts by forgetting the last one's — which is what uninstalling
 * and signing out of the App would have left behind.
 */
export function releaseRecordedGitHub(): void {
  sql(`
    ${forgetInstallation(recordedInstallation)}
    DELETE FROM integrations
    WHERE provider = 'github' AND subject_kind = 'user'
      AND subject_id IN (SELECT user_id FROM github_user_identities
                         WHERE github_user_id = ${recordedUser});
    DELETE FROM github_user_identities
    WHERE github_user_id = ${recordedUser};
    COMMIT;
  `);
}

/**
 * Hand the second recorded installation back, as uninstalling the App from
 * `fixture-org` would. A walk that binds it releases it when it ends, so the
 * next walk can bind it again; the person who authorized it is the recorded
 * one, whom `releaseRecordedGitHub` hands back.
 */
export function releaseSecondInstallation(): void {
  sql(`${forgetInstallation(secondInstallation.id)} COMMIT;`);
}

/**
 * Bind another installation, holding the named repositories, to a workspace.
 *
 * Each recorded installation holds one repository, so an installation that
 * reads more repositories than one page holds is reachable only by writing
 * the binding where the installation exchange would; the API reads it back.
 * The provider identifiers are fresh and above both recorded installations',
 * so neither release touches it.
 */
export function bindAnotherInstallation(
  workspaceId: string,
  repositories: readonly string[],
): { manageUrl: string } {
  const provider = Math.floor(Math.random() * 1e15) + 3;
  const manageUrl = `https://github.com/organizations/second/settings/installations/${provider}`;
  const names = repositories.map((name) => `'${name}'`).join(", ");
  sql(`
    INSERT INTO github_installations
      (id, github_id, app_id, organization_id, account_id, account_name,
       account_kind, manage_url, active, connected, updated_at)
    VALUES (gen_random_uuid(), ${provider}, 123, '${workspaceId}',
            ${provider}, 'second', 'organization', '${manageUrl}', true, true,
            now());
    INSERT INTO integrations
      (subject_kind, subject_id, provider, account_name, created_at)
    VALUES ('organization', '${workspaceId}', 'github', 'second', now())
    ON CONFLICT DO NOTHING;
    INSERT INTO github_repositories
      (id, installation_id, github_id, full_name, default_branch, private, active)
    SELECT gen_random_uuid(), installations.id, ${provider} + listed.position,
           listed.name, 'main', true, true
    FROM github_installations installations,
         unnest(ARRAY[${names}]) WITH ORDINALITY AS listed(name, position)
    WHERE installations.github_id = ${provider};
  `);
  return { manageUrl };
}

/**
 * Suspend the installation bound to one workspace, as GitHub does.
 *
 * A suspension is a bound row GitHub has made inactive while it stays
 * connected, exactly as reconciliation records one. No endpoint creates it, so
 * the pane and the setup steps that read a suspension are untestable without
 * writing what reconciliation would; the API reads it back, so nothing the
 * reader sees is invented.
 */
export function suspendInstallation(workspaceId: string): void {
  sql(`
    UPDATE github_installations SET active = false, updated_at = now()
    WHERE organization_id = '${workspaceId}';
  `);
}

/**
 * Take the installation away from one workspace, as removing the App on
 * GitHub does: the binding is released and the workspace's GitHub account
 * goes with it, which is the state the pane reads as nothing installed.
 */
export function disconnectInstallation(workspaceId: string): void {
  sql(`
    DELETE FROM integrations
    WHERE provider = 'github' AND subject_kind = 'organization'
      AND subject_id = '${workspaceId}';
    UPDATE github_installations
    SET connected = false, organization_id = NULL, updated_at = now()
    WHERE organization_id = '${workspaceId}';
  `);
}

/**
 * Record one pull request on the repository the project is linked to.
 *
 * Pull requests reach Mokly as provider observations — webhooks and
 * reconciliation — so no endpoint creates one and the switcher's pull-request
 * half is untestable without writing the row those would. It attaches to the
 * project's own installed repository rather than inventing a second one,
 * because a project reads the pull requests of the repository it publishes
 * from. The publication that names this number is published through the real
 * upload endpoint as usual.
 */
export function fillPullRequest(
  projectId: string,
  pull: {
    number: number;
    title: string;
    /** Null is a real observation: reconciliation predating author retention. */
    author: string | null;
    branch: string;
  },
): void {
  const author = pull.author === null ? "NULL" : `'${pull.author}'`;
  sql(`
    INSERT INTO github_pull_requests
      (repository_id, number, title, open, merged, head_ref, head_sha,
       base_ref, base_sha, updated_at, author)
    SELECT repository_id, ${pull.number}, '${pull.title}', true, false,
           '${pull.branch}', repeat('a', 40), 'main', repeat('b', 40), now(),
           ${author}
    FROM github_project_repositories WHERE project_id = '${projectId}'
    ON CONFLICT DO NOTHING;
  `);
}

/**
 * Give a project one admitted publication on each of `count` numbered branches,
 * so its branch list runs past one page and the switcher has a cursor to follow.
 *
 * Branches reach Mokly as provider observations or as the branch a publication
 * named, and these rows are the second, which is what a repository with more
 * branches than one page looks like.
 *
 * The rows are dated into the past, unlike `fillHistory`'s: a test that needs a
 * real attempt to be the newest on one of these branches publishes it through
 * the upload endpoint afterwards, and a seeded future row would outrank it.
 */
export function fillBranches(
  projectId: string,
  prefix: string,
  count: number,
  from = 1,
  /**
   * How wide the numeric suffix is. Branch names sort bytewise, so a caller
   * planting more than 999 must pad wide enough that `topic-1000` still sorts
   * after `topic-0999` rather than before it.
   */
  pad = 3,
): void {
  const last = from + count - 1;
  sql(`
    INSERT INTO publications
      (id, project_id, branch, head_sha, config_path, exported_at, state,
       created_at, deadline, changes_state)
    SELECT gen_random_uuid(), '${projectId}',
           '${prefix}' || lpad(step::text, ${pad}, '0'),
           lpad(to_hex(step), 40, '0'), 'mokly.config.json', now(), 'ready',
           now() - (step * interval '1 second'),
           now() + interval '2 days', 'no-comparison'
    FROM generate_series(${from}, ${last}) AS step;
  `);
}

/**
 * Fill a project's unfiltered history past one page, on a reference of its own.
 *
 * The rows are dated into the future so they sort ahead of the real ones: that
 * is what puts the reference under test off the first page, and it is why a
 * read that asks the project rather than the reference fails here.
 *
 * The viewer reads each reference's own history, so the page a project-wide
 * read would return is not what a row says about itself. These rows are what
 * makes that falsifiable: without them a project never has more than a handful
 * of publications and a read that ignores the reference passes anyway.
 */
export function fillHistory(
  projectId: string,
  branch: string,
  rows: number,
  from = 1,
): void {
  // One head SHA is one publication of a project, whatever branch carried it,
  // so a caller filling more than one reference gives each its own range.
  const last = from + rows - 1;
  // Admitted rows with nothing compared, which is the shape the table allows
  // without a comparison artifact behind it.
  sql(`
    INSERT INTO publications
      (id, project_id, branch, head_sha, config_path, exported_at, state,
       created_at, deadline, changes_state)
    SELECT gen_random_uuid(), '${projectId}', '${branch}',
           lpad(to_hex(step), 40, '0'), 'mokly.config.json', now(), 'ready',
           now() + (step * interval '1 second'),
           now() + interval '2 days', 'no-comparison'
    FROM generate_series(${from}, ${last}) AS step;
  `);
}
