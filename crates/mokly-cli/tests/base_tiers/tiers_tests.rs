//! Cold bases select dependency tiers one, two, and three, and run scripts only on opt-in.

use std::fs;
use std::path::{Path, PathBuf};

use mokly_test_support::files::write;
use mokly_test_support::git::git;
use mokly_test_support::readers;
use mokly_test_support::timings::timings;
use serde_json::json;

use super::cold::cold_base;
use super::support::{Host, absent, cache_namespace, children, command, diagnostics};

fn find_marker(directory: &Path) -> Option<PathBuf> {
    for entry in fs::read_dir(directory).ok()?.flatten() {
        let path = entry.path();
        let kind = entry.file_type().unwrap();
        if kind.is_file() && entry.file_name() == "lifecycle-ran" {
            return Some(path);
        }
        if kind.is_dir()
            && let Some(found) = find_marker(&path)
        {
            return Some(found);
        }
    }
    None
}

fn scripts_on_opt_in_runs_the_lifecycle_marker(config: bool, host: Host) {
    let cold = cold_base(2);
    if config {
        write(
            &cold.root,
            "mokly.config.json",
            r#"{"review":{"baseInstallScripts":true}}"#,
        );
    }
    let mut args = vec![
        "build",
        "--base=HEAD",
        "--out=.context/site",
        "--sidecars=1",
    ];
    if !config {
        args.push("--base-install-scripts");
    }
    let result = command(&cold.root, &args, &cold.env, &[], Some(host)).run();
    assert_eq!(result.code, Some(0), "{}", result.stderr);
    let namespace = cache_namespace(&result.stdout);
    assert!(
        find_marker(Path::new(&namespace)).is_some(),
        "{}\n{}",
        result.stdout,
        result.stderr
    );
}

#[test]
fn scripts_on_config_opt_in_runs_the_base_lifecycle_marker() {
    scripts_on_opt_in_runs_the_lifecycle_marker(true, Host::Local);
    scripts_on_opt_in_runs_the_lifecycle_marker(true, Host::Hosted);
}

#[test]
fn scripts_on_flag_opt_in_runs_the_base_lifecycle_marker() {
    scripts_on_opt_in_runs_the_lifecycle_marker(false, Host::Local);
    scripts_on_opt_in_runs_the_lifecycle_marker(false, Host::Hosted);
}

fn cold_base_tier(tier: u8, host: Host) {
    let cold = cold_base(tier);
    let root = &cold.root;
    let working = git(root, &["status", "--porcelain"]);
    assert_eq!(fs::read_dir(&cold.cache).unwrap().count(), 0);
    let mut args = vec![
        "build",
        "--base=HEAD",
        "--out=.context/site",
        "--sidecars=1",
        "--debug-timings",
    ];
    if tier == 3 {
        args.push("--strict");
    }
    let result = command(root, &args, &cold.env, &[], Some(host)).run();
    assert_eq!(result.code, Some(0), "{}", result.stderr);
    let spans: Vec<_> = timings(&result.stderr)
        .into_iter()
        .filter(|record| {
            record.field("role") == "core" && record.stage() == "review.base-dependencies"
        })
        .collect();
    let events: Vec<_> = spans.iter().map(|record| record.event()).collect();
    assert_eq!(events, ["start", "end"]);
    assert_eq!(spans[1].field("id"), spans[0].field("id"));
    assert_eq!(spans[1].status(), Some("ok"));
    assert_eq!(spans[1].field("tier"), tier);
    let printed = diagnostics(&result.stderr);
    let expected = if tier == 3 {
        "[mokly/warning] configuration \"mokly.config.json\": base dependencies at \"package-lock.json\" could not be installed (installation failed); using working-tree dependencies\n"
    } else {
        ""
    };
    assert_eq!(printed, expected);
    let output = root.join(".context/site");
    let index = readers::index(&fs::read(output.join("mokly-viewer/index.json")).unwrap());
    assert_eq!(index["changesStatus"], "ready");
    assert_eq!(index["base"], "HEAD");
    let comparison_url = index["comparisonUrl"].as_str().expect("a comparison URL");
    let review = readers::review(&fs::read(output.join(comparison_url)).unwrap());
    assert_eq!(review["schemaVersion"], 8);
    assert_eq!(review["baseCommit"], cold.base.as_str());
    assert_eq!(review["diagnostics"], json!([]));
    assert_eq!(review["entries"], json!([]));
    let pages: Vec<_> = index["pages"]
        .as_array()
        .unwrap()
        .iter()
        .map(|page| (page["path"].as_str().unwrap(), page["changes"].clone()))
        .collect();
    let state = |kind: &str, included: bool| json!({ "status": "ready", "kind": kind, "included": included });
    let welcome = index["pages"]
        .as_array()
        .unwrap()
        .iter()
        .find(|page| page["path"] == "welcome")
        .unwrap();
    assert_eq!(welcome["title"], "Welcome");
    assert_eq!(
        pages,
        [
            (
                "dependency",
                state(if tier == 2 { "changed" } else { "unmodified" }, tier == 2)
            ),
            ("source", state("changed", true)),
            ("welcome", state("unmodified", false)),
        ]
    );
    let prefix = comparison_url.rsplit_once('/').unwrap().0;
    for side in ["before", "after"] {
        for (entry, text) in [
            ("welcome", "Welcome"),
            (
                "source",
                if side == "before" {
                    "Base source"
                } else {
                    "Working source"
                },
            ),
            (
                "dependency",
                if side == "before" && tier == 2 {
                    "Base dependency"
                } else {
                    "Working dependency"
                },
            ),
        ] {
            let document = fs::read_to_string(output.join(format!(
                "{prefix}/snapshots/{side}/mokly-generated/{entry}/index.html"
            )))
            .unwrap();
            assert!(document.contains(&format!("<h1>{text}</h1>")), "{document}");
            assert!(!document.contains("base-dependencies"));
        }
    }
    let announcements: Vec<_> = result
        .stdout
        .split('\n')
        .filter(|line| line.starts_with("Mokly cache: "))
        .collect();
    assert_eq!(announcements.len(), 1);
    let namespace = PathBuf::from(cache_namespace(&result.stdout));
    let relative = namespace
        .strip_prefix(&cold.cache)
        .expect("the namespace is in the cache");
    assert!(!relative.as_os_str().is_empty());
    let sources = namespace.join("sources/entries");
    let source_entries = children(&sources);
    assert_eq!(source_entries.len(), 1);
    let key = &source_entries[0];
    assert!(
        key.len() == 64
            && key
                .bytes()
                .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
    );
    assert_ne!(key, &cold.base);
    let extracted = sources.join(key).join("data");
    assert_eq!(
        fs::read_to_string(extracted.join("specs/source-value.ts")).unwrap(),
        "export const value = 'Base source';"
    );
    absent(&extracted.join("node_modules"));
    let installs = namespace.join("dependencies/entries");
    let entries = children(&installs);
    assert_eq!(entries.len(), if tier == 2 { 1 } else { 0 });
    for entry in &entries {
        let installed = installs.join(entry).join("data");
        let index_js =
            fs::read_to_string(installed.join("node_modules/mokly-cold-dependency/index.js"))
                .unwrap();
        assert!(index_js.contains("Base dependency"));
        assert!(installs.join(entry).join("receipt.json").exists());
        absent(&installed.join(".npm-cache"));
        absent(&installed.join("lifecycle-ran"));
        absent(&installed.join("node_modules/mokly-cold-dependency/lifecycle-ran"));
    }
    absent(&root.join("lifecycle-ran"));
    absent(&root.join("node_modules/mokly-cold-dependency/lifecycle-ran"));
    let repeated = command(
        root,
        &[
            "build",
            "--base=HEAD",
            "--out=.context/repeated",
            "--sidecars=1",
        ],
        &cold.env,
        &[],
        Some(host),
    )
    .run();
    assert_eq!(repeated.code, Some(0), "{}", repeated.stderr);
    assert_eq!(children(&sources), source_entries);
    assert_eq!(git(root, &["status", "--porcelain"]), working);
}

#[test]
fn a_cold_base_build_reuses_working_dependencies_when_identities_match() {
    cold_base_tier(1, Host::Local);
    cold_base_tier(1, Host::Hosted);
}

#[test]
fn a_cold_base_build_installs_locked_dependencies_offline_without_lifecycle_scripts() {
    cold_base_tier(2, Host::Local);
    cold_base_tier(2, Host::Hosted);
}

#[test]
fn a_strict_cold_base_build_warns_and_uses_working_dependencies_when_the_offline_install_fails() {
    cold_base_tier(3, Host::Local);
    cold_base_tier(3, Host::Hosted);
}
