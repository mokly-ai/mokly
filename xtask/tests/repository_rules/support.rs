//! Repository paths, text reads, YAML documents, and automation file lists.

use std::fs;
use std::path::{Path, PathBuf};

use yaml_rust2::yaml::Hash;
use yaml_rust2::{Yaml, YamlLoader};

/// The repository root: the parent of the `xtask` manifest directory.
pub(crate) fn repository_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("xtask lives in the repository root")
        .to_path_buf()
}

/// Read a repository file named by its repository-relative POSIX path.
pub(crate) fn read_text(file: &str) -> String {
    fs::read_to_string(repository_root().join(file))
        .unwrap_or_else(|error| panic!("read {file}: {error}"))
}

/// Parse the single YAML document of a repository file.
pub(crate) fn read_yaml(file: &str) -> Yaml {
    parse_yaml(&read_text(file), file)
}

/// Parse the single YAML document of a text.
pub(crate) fn parse_yaml(source: &str, context: &str) -> Yaml {
    let mut documents = YamlLoader::load_from_str(source)
        .unwrap_or_else(|error| panic!("parse {context}: {error}"));
    assert_eq!(documents.len(), 1, "{context} holds one YAML document");
    documents.remove(0)
}

/// The workflow files, `.yml` or `.yaml`, as sorted repository-relative paths.
pub(crate) fn workflow_files() -> Vec<String> {
    let mut files: Vec<String> = directory_names(".github/workflows")
        .into_iter()
        .filter(|name| name.ends_with(".yml") || name.ends_with(".yaml"))
        .map(|name| format!(".github/workflows/{name}"))
        .collect();
    files.sort();
    files
}

/// One manifest path for each directory under `.github/actions`, also when
/// the manifest is missing.
pub(crate) fn action_manifests() -> Vec<String> {
    let root = repository_root().join(".github/actions");
    let mut files: Vec<String> = directory_names(".github/actions")
        .into_iter()
        .filter(|name| root.join(name).is_dir())
        .map(|name| format!(".github/actions/{name}/action.yml"))
        .collect();
    files.sort();
    files
}

/// The workflow files and the composite action manifests that exist, sorted.
pub(crate) fn automation_files() -> Vec<String> {
    let root = repository_root();
    let mut files = workflow_files();
    files.extend(
        action_manifests()
            .into_iter()
            .filter(|file| root.join(file).exists()),
    );
    files.sort();
    files
}

/// The names of the entries of one repository directory.
fn directory_names(directory: &str) -> Vec<String> {
    fs::read_dir(repository_root().join(directory))
        .unwrap_or_else(|error| panic!("list {directory}: {error}"))
        .map(|entry| {
            let name = entry.unwrap().file_name();
            name.into_string().expect("entry names are UTF-8")
        })
        .collect()
}

/// The mapping of a YAML value; fails when the value is not a mapping.
pub(crate) fn mapping<'a>(value: &'a Yaml, context: &str) -> &'a Hash {
    value
        .as_hash()
        .unwrap_or_else(|| panic!("{context} must be a mapping"))
}

/// Assert that a YAML value is a mapping.
pub(crate) fn assert_mapping(value: &Yaml, context: &str) {
    assert!(value.as_hash().is_some(), "{context} must be a mapping");
}

/// The keys of a mapping in document order; fails on a key that is not text.
pub(crate) fn keys(hash: &Hash) -> Vec<&str> {
    hash.keys()
        .map(|key| key.as_str().expect("mapping keys are strings"))
        .collect()
}

/// The jobs of a workflow in document order, or none without `jobs`.
pub(crate) fn jobs(document: &Yaml) -> Vec<(&str, &Yaml)> {
    let Some(jobs) = document["jobs"].as_hash() else {
        return Vec::new();
    };
    jobs.iter()
        .map(|(name, job)| (name.as_str().expect("job names are strings"), job))
        .collect()
}

/// The steps of a job or a composite action's `runs`, or none.
pub(crate) fn steps(owner: &Yaml) -> &[Yaml] {
    owner["steps"].as_vec().map_or(&[], Vec::as_slice)
}

/// Every step of a workflow or a composite action: the job steps, then the
/// steps of `runs`.
pub(crate) fn all_steps(document: &Yaml) -> Vec<&Yaml> {
    jobs(document)
        .into_iter()
        .flat_map(|(_, job)| steps(job))
        .chain(steps(&document["runs"]))
        .collect()
}

/// The `run` script of every step that has a text script.
pub(crate) fn run_scripts(document: &Yaml) -> Vec<&str> {
    all_steps(document)
        .into_iter()
        .filter_map(|step| step["run"].as_str())
        .collect()
}

/// The first step of a list with the given `name`.
pub(crate) fn named<'a>(steps: &'a [Yaml], name: &str) -> Option<&'a Yaml> {
    steps
        .iter()
        .find(|step| step["name"].as_str() == Some(name))
}

/// JavaScript truthiness of a YAML value. A missing key is `BadValue`.
pub(crate) fn truthy(value: &Yaml) -> bool {
    match value {
        Yaml::BadValue | Yaml::Null | Yaml::Boolean(false) | Yaml::Integer(0) => false,
        Yaml::String(text) => !text.is_empty(),
        Yaml::Real(_) => value.as_f64().is_some_and(|number| number != 0.0),
        _ => true,
    }
}

/// Strict deep equality as `assert.deepEqual` defines it: mappings compare
/// without key order, and lists compare in order.
pub(crate) fn deep_equal(left: &Yaml, right: &Yaml) -> bool {
    match (left, right) {
        (Yaml::Hash(left), Yaml::Hash(right)) => {
            left.len() == right.len()
                && left.iter().all(|(key, value)| {
                    right.get(key).is_some_and(|other| deep_equal(value, other))
                })
        }
        (Yaml::Array(left), Yaml::Array(right)) => {
            left.len() == right.len()
                && left
                    .iter()
                    .zip(right)
                    .all(|(value, other)| deep_equal(value, other))
        }
        _ => left == right,
    }
}
