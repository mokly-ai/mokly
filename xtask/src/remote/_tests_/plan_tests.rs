//! Cloud worker coverage, shard forwarding and the embedded CI shard totals.

use std::num::NonZeroU8;

use crate::check::request::{DependencyAudit, VerificationSuite};
use crate::remote::error::Error;
use crate::remote::plan::plan_support::ci_shard_totals;
use crate::remote::plan::{Shard, ShardTotals, commands, commands_for};

/// Literal totals that differ from each other and from the CI file.
fn totals(viewer: u8, browser: u8) -> ShardTotals {
    ShardTotals {
        viewer: NonZeroU8::new(viewer).unwrap(),
        browser: NonZeroU8::new(browser).unwrap(),
    }
}

#[test]
fn cloud_inventory_covers_each_suite_once_before_app_shard_expansion() {
    let commands = commands_for(totals(2, 5), DependencyAudit::Baseline);
    let mut actual = commands
        .iter()
        .filter(|command| command.shard.is_none_or(|shard| shard.index == 1))
        .filter_map(|command| {
            command
                .shell_command("sha256:abc")
                .split_once(" --suites ")
                .map(|(_, args)| args.split_whitespace().next().unwrap().to_owned())
        })
        .flat_map(|suites| suites.split(',').map(str::to_owned).collect::<Vec<_>>())
        .collect::<Vec<_>>();
    actual.sort();
    let mut expected = VerificationSuite::CLOUD
        .into_iter()
        .map(VerificationSuite::as_str)
        .collect::<Vec<_>>();
    expected.sort();
    assert_eq!(actual, expected);
    let rust = commands
        .iter()
        .find(|command| command.name == "cloud-rust")
        .unwrap();
    assert_eq!(
        rust.shell_command("sha256:abc"),
        "node scripts/verification/refresh-source-mtimes.mjs && node xtask/scripts/testbox-cloud.mjs --expect sha256:abc --suites cloud-rust,cloud-desktop"
    );
}

#[test]
fn cloud_app_workers_forward_all_four_shards_for_any_ci_totals() {
    for (viewer, browser) in [(1, 1), (2, 5)] {
        let actual = commands_for(totals(viewer, browser), DependencyAudit::Baseline)
            .into_iter()
            .filter(|command| command.name.starts_with("cloud-app-"))
            .map(|command| (command.shard, command.shell_command("sha256:abc")))
            .collect::<Vec<_>>();
        let expected = (1..=4)
            .map(|index| {
                (Some(Shard { index, total: 4 }), format!(
                    "node scripts/verification/refresh-source-mtimes.mjs && node xtask/scripts/testbox-cloud.mjs --expect sha256:abc --suites cloud-app --shard {index}/4"
                ))
            })
            .collect::<Vec<_>>();
        assert_eq!(actual, expected, "viewer={viewer} browser={browser}");
    }
}

#[test]
fn single_viewer_and_browser_shards_still_pass_one_of_one() {
    let commands = commands_for(totals(1, 1), DependencyAudit::Baseline);
    let actual = commands
        .iter()
        .filter(|command| command.report)
        .map(|command| (command.name.as_str(), command.shell_command("sha256:abc")))
        .collect::<Vec<_>>();
    assert_eq!(
        actual,
        [
            (
                "viewer-1-of-1",
                "node scripts/verification/refresh-source-mtimes.mjs && node scripts/verification/testbox-suite.mjs --expect sha256:abc --suite viewer --shard 1/1".to_owned()
            ),
            (
                "browser-1-of-1",
                "node scripts/verification/refresh-source-mtimes.mjs && node scripts/verification/testbox-suite.mjs --expect sha256:abc --suite browser --shard 1/1".to_owned()
            ),
        ]
    );
    assert_eq!(commands.len(), 11);
}

#[test]
fn embedded_ci_shards_plan_one_command_per_viewer_and_browser_shard() {
    let expected = ci_shard_totals();
    let commands = commands(DependencyAudit::Baseline).unwrap();
    let names = |suite: &str| {
        commands
            .iter()
            .filter(|command| command.report && command.name.starts_with(suite))
            .map(|command| command.name.clone())
            .collect::<Vec<_>>()
    };
    let viewer = expected.viewer.get();
    let browser = expected.browser.get();
    assert_eq!(
        names("viewer-"),
        (1..=viewer)
            .map(|index| format!("viewer-{index}-of-{viewer}"))
            .collect::<Vec<_>>()
    );
    assert_eq!(
        names("browser-"),
        (1..=browser)
            .map(|index| format!("browser-{index}-of-{browser}"))
            .collect::<Vec<_>>()
    );
}

#[test]
fn invalid_ci_shard_totals_fail_with_the_shard_file_error() {
    for text in [
        "",
        r#"{"viewer": 0, "browser": 10}"#,
        r#"{"viewer": 2, "browser": 256}"#,
        r#"{"viewer": 2}"#,
        r#"{"viewer": 2, "browser": 10, "native": 1}"#,
    ] {
        let result = ShardTotals::parse(text);
        assert!(
            matches!(result, Err(Error::ShardTotals(_))),
            "{text}: {result:?}"
        );
    }
}
