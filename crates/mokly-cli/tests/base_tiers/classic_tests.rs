//! Yarn Classic bases with nested file dependencies and a committed offline mirror.

use std::fs;
use std::path::Path;

use mokly_test_support::files::write;
use mokly_test_support::git::{commit_all, git};
use mokly_test_support::npm;
use mokly_test_support::timings::timings;
use serde_json::json;

use super::cold::{ColdBase, cold_base};
use super::manager_fixture::{Mode, manager_base};
use super::managers::MANAGERS;
use super::probe::{Probe, instrument, read};
use super::support::{Host, build, command};

/// A cold Yarn Classic workspace whose nested `packages/app` names its archive with `file:`.
fn nested(outside: bool) -> (ColdBase, Probe) {
    let classic = &MANAGERS[1];
    let mut cold = cold_base(2);
    let root = cold.root.clone();
    git(&root, &["checkout", "HEAD", "--", "specs/source-value.ts"]);
    fs::remove_file(root.join("package-lock.json")).unwrap();
    fs::remove_dir_all(root.join("node_modules")).unwrap();
    write(&root, ".gitignore", "node_modules/\n.context/\n");
    write(&root, ".yarnrc", "disable-self-update-check true\n");
    let manifests = |version: &str| {
        let archive = format!("dependency-{version}.tgz");
        fs::create_dir_all(root.join("packages")).unwrap();
        let target = if outside {
            root.parent().unwrap().to_path_buf()
        } else {
            root.join("packages")
        };
        fs::copy(root.join("vendor").join(&archive), target.join(&archive)).unwrap();
        write(
            &root,
            "package.json",
            json!({
                "name": "cold-base-fixture",
                "version": "1.0.0",
                "private": true,
                "packageManager": format!("yarn@{}", classic.version),
                "workspaces": ["packages/*"],
            })
            .to_string(),
        );
        let reference = format!("file:{}/{archive}", if outside { "../../.." } else { ".." });
        write(
            &root,
            "packages/app/package.json",
            json!({ "name": "app", "version": "1.0.0", "dependencies": { "mokly-cold-dependency": reference } })
                .to_string(),
        );
    };
    manifests("1.0.0");
    classic.install(&root, &cold.env);
    commit_all(&root, "nested Classic base fixture");
    manifests("2.0.0");
    classic.install(&root, &cold.env);
    write(
        &root,
        "specs/source-value.ts",
        "export const value = 'Working source';",
    );
    let probe = instrument(&root, None);
    cold.env
        .push(("PATH".to_owned(), classic.path(&root, false)));
    cold.env
        .push(("NODE_OPTIONS".to_owned(), probe.node_options.clone()));
    (cold, probe)
}

fn nested_inside_installs_on_tier_two(host: Host) {
    let (cold, probe) = nested(false);
    let (built, finished) = build(&cold.root, &cold.env, &[], Some(&probe.network), host);
    assert_eq!(
        built.tier,
        Some(2),
        "{}\n{}",
        finished.stderr,
        read(&probe.output)
    );
    assert!(!finished.stderr.contains("base dependencies"));
    let entries = Path::new(&built.namespace).join("dependencies/entries");
    let key = fs::read_dir(&entries)
        .unwrap()
        .next()
        .unwrap()
        .unwrap()
        .path();
    let index_js =
        fs::read_to_string(key.join("data/node_modules/mokly-cold-dependency/index.js")).unwrap();
    assert!(index_js.contains("Base dependency"));
    let calls = read(&probe.calls);
    assert_eq!(calls.trim().split('\n').count(), 1, "{calls}");
}

#[test]
fn a_nested_yarn_classic_file_dependency_inside_the_repository_installs_on_tier_two() {
    nested_inside_installs_on_tier_two(Host::Local);
    nested_inside_installs_on_tier_two(Host::Hosted);
}

#[test]
fn a_nested_yarn_classic_file_dependency_that_leaves_the_repository_falls_back() {
    for host in [Host::Local, Host::Hosted] {
        let (cold, probe) = nested(true);
        let (built, finished) = build(&cold.root, &cold.env, &[], Some(&probe.network), host);
        assert_eq!(built.tier, Some(3), "{}", finished.stderr);
        assert!(
            finished
                .stderr
                .contains("local package outside the repository")
        );
        assert_eq!(read(&probe.calls), "");
    }
}

fn installs_from_the_offline_mirror(host: Host) {
    let fixture = manager_base(&MANAGERS[1], Mode::Installed);
    let cold = &fixture.cold;
    let root = &cold.root;
    let working_manifest = fs::read(root.join("package.json")).unwrap();
    let working_lock = fs::read(root.join("yarn.lock")).unwrap();
    let base_manifest = git(root, &["show", "HEAD:package.json"]);
    write(
        root,
        "package.json",
        base_manifest.replace("file:vendor/dependency-1.0.0.tgz", "1.0.0"),
    );
    let archive = fs::read(root.join("vendor/dependency-1.0.0.tgz")).unwrap();
    let hash = npm::sha1(&archive);
    write(
        root,
        "yarn.lock",
        format!(
            "# yarn lockfile v1\n\n\"mokly-cold-dependency@1.0.0\":\n  version \"1.0.0\"\n  resolved \"https://registry.invalid/mokly-cold-dependency/-/mokly-cold-dependency-1.0.0.tgz#{hash}\"\n"
        ),
    );
    write(root, ".yarnrc", "yarn-offline-mirror \"./offline\"\n");
    write(root, "offline/mokly-cold-dependency-1.0.0.tgz", &archive);
    commit_all(root, "offline mirror base fixture");
    fs::write(root.join("package.json"), working_manifest).unwrap();
    fs::write(root.join("yarn.lock"), working_lock).unwrap();
    let external = root.join(".context/external-mirror");
    fs::create_dir(&external).unwrap();
    assert_eq!(fs::read_dir(&cold.cache).unwrap().count(), 0);
    let result = command(
        root,
        &[
            "build",
            "--base=HEAD",
            "--out=.context/site",
            "--sidecars=1",
            "--debug-timings",
        ],
        &cold.env,
        &[],
        Some(host),
    )
    .env("yarn_yarn_offline_mirror", &external)
    .run();
    assert_eq!(result.code, Some(0), "{}", result.stderr);
    assert_eq!(read(&fixture.probe.network), "");
    assert_eq!(fs::read_dir(&external).unwrap().count(), 0);
    let tier = timings(&result.stderr)
        .into_iter()
        .find(|record| record.stage() == "review.base-dependencies" && record.event() == "end")
        .and_then(|record| record.field("tier").as_u64());
    assert_eq!(
        tier,
        Some(2),
        "{}\n{}",
        result.stderr,
        read(&fixture.probe.output)
    );
    assert!(!result.stderr.contains("base dependencies at"));
    assert_eq!(read(&fixture.probe.calls).trim().split('\n').count(), 1);
}

#[test]
fn a_cold_yarn_classic_base_installs_ordinary_versions_from_its_committed_offline_mirror() {
    installs_from_the_offline_mirror(Host::Local);
    installs_from_the_offline_mirror(Host::Hosted);
}
