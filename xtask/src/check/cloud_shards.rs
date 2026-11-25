//! Shard plans of the cloud suites that run Playwright: app, mockups, and site.

use crate::command::CommandSpec;

use super::cloud_commands::{built, npm};
use super::request::Shard;

const APP: &str = "@mokly-cloud/app";
const MOCKUPS: &str = "@mokly-cloud/mockups";
const SITE: &str = "@mokly-cloud/site";

/// Mockup shards that own the checks outside the disk browser suite.
const MOCKUP_LEADING_SHARDS: u64 = 2;

/// Every app shard builds its own web export; shard 1 also runs the logic tests.
pub(super) fn app_commands(shard: Option<Shard>) -> Vec<CommandSpec> {
    let mut commands = built([]);
    commands.push(CommandSpec::new("node").args(["xtask/scripts/require-postgres.mjs"]));
    let scripts = if shard.is_none_or(Shard::is_first) {
        vec!["test:logic", "build:web", "test:browser"]
    } else {
        vec!["build:web", "test:browser"]
    };
    let value = shard.map(|shard| shard.to_string());
    commands.extend(scripts.into_iter().map(|script| {
        npm(&["run", script, "--workspace", APP])
            .with_environment("MKC_APP_SHARD", value.as_deref())
            .with_environment("CI", Some("1"))
    }));
    commands
}

/// Every mockup shard builds the catalogue that the checks read.
///
/// With three or more shards, shard 1 runs the checks without a browser,
/// shard 2 runs the policy tests and the served suite, and the other shards
/// split the disk suite. Two shards split the work into a part without a
/// browser and a browser part. One shard, or none, runs the complete suite.
pub(super) fn mockup_commands(shard: Option<Shard>) -> Vec<CommandSpec> {
    let Some(shard) = shard.filter(|shard| shard.total() > 1) else {
        return built(["mockups:build", "mockups:test", "mockups:typecheck"]);
    };
    let static_checks = ["test:determinism", "mockups:typecheck"];
    let mut commands = built(["mockups:build"]);
    match (shard.index(), shard.total()) {
        (1, 2) => {
            commands.extend(static_checks.map(mockups));
            commands.push(mockups("test:policy"));
        }
        (2, 2) => commands.extend([mockup_disk(None), mockups("test:serve")]),
        (1, _) => commands.extend(static_checks.map(mockups)),
        (2, _) => commands.extend(["test:policy", "test:serve"].map(mockups)),
        _ => commands.push(mockup_disk(shard.after(MOCKUP_LEADING_SHARDS))),
    }
    commands
}

/// Every site shard builds the site and runs one Playwright shard; shard 1
/// also runs the type, unit, and link checks.
pub(super) fn site_commands(shard: Option<Shard>) -> Vec<CommandSpec> {
    let Some(shard) = shard.filter(|shard| shard.total() > 1) else {
        return built(["site:check"]);
    };
    let mut commands = built(["site:build"]);
    if shard.is_first() {
        commands.extend(
            ["site:typecheck", "site:test", "site:links"].map(|script| npm(&["run", script])),
        );
    }
    let value = shard.to_string();
    commands.push(npm(&[
        "run",
        "browser",
        "--workspace",
        SITE,
        "--",
        "--shard",
        &value,
    ]));
    commands
}

fn mockups(script: &str) -> CommandSpec {
    npm(&["run", script, "--workspace", MOCKUPS])
}

fn mockup_disk(shard: Option<Shard>) -> CommandSpec {
    let command = mockups("test:disk");
    match shard {
        Some(shard) => command.args(["--".to_owned(), "--shard".to_owned(), shard.to_string()]),
        None => command,
    }
}
