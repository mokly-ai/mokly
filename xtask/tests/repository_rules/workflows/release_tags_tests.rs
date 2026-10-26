//! The release tag job runs one pinned script step after release selection.
//! The Node test `tests/release_tags.test.ts` runs that script.

use regex::Regex;
use yaml_rust2::Yaml;

use crate::support::{assert_mapping, deep_equal, parse_yaml, read_yaml};

#[test]
fn the_release_tag_job_runs_one_pinned_script_after_release_selection() {
    let workflow = read_yaml(".github/workflows/release.yml");
    let jobs = &workflow["jobs"];
    assert_mapping(jobs, "release.yml jobs");
    let job = &jobs["release-tags"];
    assert_mapping(job, "the release-tags job");
    assert!(deep_equal(
        &job["permissions"],
        &parse_yaml("contents: write\n", "the expected tag permissions")
    ));
    assert!(job["environment"].is_badvalue());
    assert!(deep_equal(
        &job["needs"],
        &parse_yaml("[select-release]\n", "the expected tag needs")
    ));
    let condition = job["if"].as_str().unwrap_or_default();
    assert!(condition.contains("needs.select-release.result == 'success'"));
    assert!(condition.contains("publish_ref != ''"));
    let job_steps = job["steps"].as_vec().expect("the tag job has steps");
    assert_eq!(job_steps.len(), 1, "tagging executes no checkout or build");
    let step = &job_steps[0];
    assert_mapping(step, "the tag step");
    assert!(
        Regex::new(r"^actions/github-script@[a-f0-9]{40}$")
            .unwrap()
            .is_match(step["uses"].as_str().unwrap_or_default())
    );
    assert!(deep_equal(
        &step["env"],
        &parse_yaml(
            "PUBLISH_REF: ${{ needs.select-release.outputs.publish_ref }}\n",
            "the expected tag environment",
        )
    ));
    for name in ["build-native", "prepare-release"] {
        let dependent = &jobs[name];
        assert_mapping(dependent, name);
        let needs = dependent["needs"]
            .as_vec()
            .expect("dependent jobs list needs");
        assert!(needs.contains(&Yaml::String("release-tags".to_owned())));
        assert!(
            dependent["if"]
                .as_str()
                .unwrap_or_default()
                .contains("needs.release-tags.result == 'success'"),
            "{name}"
        );
    }
    assert_mapping(&step["with"], "the tag step inputs");
    assert!(step["with"]["script"].as_str().is_some());
}
