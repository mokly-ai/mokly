//! The CI job limits keep the measured three-times timing contract.

use std::collections::BTreeMap;

use crate::support::{jobs, read_yaml};

#[test]
fn ci_job_limits_keep_the_measured_three_times_timing_contract() {
    let workflow = read_yaml(".github/workflows/ci.yml");
    let limits: BTreeMap<&str, Option<i64>> = jobs(&workflow)
        .into_iter()
        .map(|(name, job)| (name, job["timeout-minutes"].as_i64()))
        .collect();
    let expected = BTreeMap::from([
        ("profile", Some(30)),
        ("repository", Some(75)),
        ("viewer", Some(40)),
        ("browser", Some(60)),
        ("native", Some(60)),
        ("static-delivery", Some(60)),
        ("required", Some(30)),
    ]);
    assert_eq!(limits, expected);
}
