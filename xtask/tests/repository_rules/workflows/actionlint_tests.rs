//! The actionlint configuration names exactly the Blacksmith runner labels.

use std::collections::BTreeSet;

use yaml_rust2::Yaml;

use crate::support::{assert_mapping, keys, mapping, read_yaml, truthy, workflow_files};

#[test]
fn actionlint_configuration_lists_exactly_the_workflow_runner_labels() {
    let config = read_yaml(".github/actionlint.yaml");
    let runner_config = &config["self-hosted-runner"];
    let labels = runner_config["labels"]
        .as_vec()
        .expect("the runner labels are a list");
    assert_eq!(
        keys(mapping(&config, "actionlint.yaml")),
        ["self-hosted-runner"]
    );
    assert_eq!(
        keys(mapping(runner_config, "self-hosted-runner")),
        ["labels"]
    );

    let mut used = BTreeSet::new();
    for file in workflow_files()
        .into_iter()
        .filter(|file| file.ends_with(".yml"))
    {
        let workflow = read_yaml(&file);
        for job in mapping(&workflow["jobs"], &file).values() {
            assert_mapping(job, &file);
            for candidate in runner_candidates(job, &file) {
                if let Some(label) = candidate.as_str()
                    && label.starts_with("blacksmith-")
                {
                    used.insert(label.to_owned());
                }
            }
        }
    }
    let labels: Vec<&str> = labels
        .iter()
        .map(|label| label.as_str().expect("runner labels are strings"))
        .collect();
    assert_eq!(labels, used.iter().map(String::as_str).collect::<Vec<_>>());
}

/// The runner candidates of a job: the matrix values when the job has a
/// matrix, otherwise its `runs-on` value.
fn runner_candidates<'a>(job: &'a Yaml, file: &str) -> Vec<&'a Yaml> {
    let strategy = &job["strategy"];
    if !truthy(strategy) {
        return vec![&job["runs-on"]];
    }
    assert_mapping(strategy, file);
    let matrix = &strategy["matrix"];
    if !truthy(matrix) {
        return vec![&job["runs-on"]];
    }
    mapping(matrix, file)
        .values()
        .flat_map(matrix_values)
        .collect()
}

/// The runner candidates of one matrix value: the value itself, the items of
/// a list, and the values of each mapping item.
fn matrix_values(value: &Yaml) -> Vec<&Yaml> {
    let Some(items) = value.as_vec() else {
        return vec![value];
    };
    items
        .iter()
        .flat_map(|item| match item.as_hash() {
            Some(row) => row.values().collect(),
            None => vec![item],
        })
        .collect()
}
