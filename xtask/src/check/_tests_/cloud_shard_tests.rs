//! Mockup and site shard plans.

use std::str::FromStr;

use super::commands::commands_for;
use super::request::{CheckRequest, DependencyAudit, Shard, VerificationSuite};

const STRICT: &str = "node xtask/scripts/strict-command.mjs ";

fn displays(suite: VerificationSuite, shard: Option<&str>) -> Vec<String> {
    let shard = shard.map(|value| Shard::from_str(value).unwrap());
    CheckRequest::new(Some(suite), shard, None).unwrap();
    commands_for(suite, shard, DependencyAudit::Baseline)
        .iter()
        .map(|command| command.display().replacen(STRICT, "", 1))
        .collect()
}

#[test]
fn mockup_shards_split_the_checks_the_policy_and_served_suites_and_the_disk_suite() {
    let lead = [
        "npm run build".to_owned(),
        "npm run mockups:build".to_owned(),
    ];
    let cases = [
        (
            "1/6",
            vec!["npm run test:determinism --workspace \"@mokly-cloud/mockups\""],
        ),
        (
            "2/6",
            vec![
                "npm run test:policy --workspace \"@mokly-cloud/mockups\"",
                "npm run test:serve --workspace \"@mokly-cloud/mockups\"",
            ],
        ),
        (
            "3/6",
            vec!["npm run test:disk --workspace \"@mokly-cloud/mockups\" -- --shard 1/4"],
        ),
        (
            "6/6",
            vec!["npm run test:disk --workspace \"@mokly-cloud/mockups\" -- --shard 4/4"],
        ),
        (
            "1/2",
            vec![
                "npm run test:determinism --workspace \"@mokly-cloud/mockups\"",
                "npm run test:policy --workspace \"@mokly-cloud/mockups\"",
            ],
        ),
        (
            "2/2",
            vec![
                "npm run test:disk --workspace \"@mokly-cloud/mockups\"",
                "npm run test:serve --workspace \"@mokly-cloud/mockups\"",
            ],
        ),
    ];
    for (shard, own) in cases {
        let expected: Vec<String> = lead
            .iter()
            .cloned()
            .chain(own.into_iter().map(str::to_owned))
            .collect();
        assert_eq!(
            displays(VerificationSuite::CloudMockups, Some(shard)),
            expected,
            "mockup shard {shard}"
        );
    }
}

#[test]
fn one_mockup_shard_and_no_shard_run_the_complete_suite() {
    let complete = [
        "npm run build",
        "npm run mockups:build",
        "npm run mockups:test",
    ];
    assert_eq!(displays(VerificationSuite::CloudMockups, None), complete);
    assert_eq!(
        displays(VerificationSuite::CloudMockups, Some("1/1")),
        complete
    );
}

#[test]
fn site_shards_split_the_browser_suite_and_check_units_and_links_once() {
    assert_eq!(
        displays(VerificationSuite::CloudSite, Some("1/2")),
        [
            "npm run build",
            "npm run site:build",
            "npm run site:test",
            "npm run site:links",
            "npm run browser --workspace \"@mokly-cloud/site\" -- --shard 1/2",
        ]
    );
    assert_eq!(
        displays(VerificationSuite::CloudSite, Some("2/2")),
        [
            "npm run build",
            "npm run site:build",
            "npm run browser --workspace \"@mokly-cloud/site\" -- --shard 2/2",
        ]
    );
    for shard in [None, Some("1/1")] {
        assert_eq!(
            displays(VerificationSuite::CloudSite, shard),
            [
                "npm run build",
                "npm run site:build",
                "npm run site:test",
                "npm run site:links",
                "npm run site:browser",
            ]
        );
    }
}
