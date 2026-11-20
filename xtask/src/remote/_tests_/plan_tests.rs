//! Cloud worker coverage and validated shard forwarding.

use crate::check::request::{DependencyAudit, VerificationSuite};
use crate::remote::plan::commands;

#[test]
fn cloud_inventory_covers_each_suite_once_before_app_shard_expansion() {
    let commands = commands(DependencyAudit::Baseline);
    let mut actual = commands
        .iter()
        .filter(|command| command.shard.is_none_or(|index| index == 1))
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
    assert_eq!(
        commands[7].shell_command("sha256:abc"),
        "node scripts/verification/refresh-source-mtimes.mjs && node xtask/scripts/testbox-cloud.mjs --expect sha256:abc --suites cloud-rust,cloud-desktop"
    );
}

#[test]
fn cloud_app_workers_forward_all_four_shards() {
    let actual = commands(DependencyAudit::Baseline)
        .into_iter()
        .filter(|command| command.name.starts_with("cloud-app-"))
        .map(|command| (command.shard, command.shell_command("sha256:abc")))
        .collect::<Vec<_>>();
    let expected = (1..=4)
        .map(|index| {
            (Some(index), format!(
                "node scripts/verification/refresh-source-mtimes.mjs && node xtask/scripts/testbox-cloud.mjs --expect sha256:abc --suites cloud-app --shard {index}/4"
            ))
        })
        .collect::<Vec<_>>();
    assert_eq!(actual, expected);
}
