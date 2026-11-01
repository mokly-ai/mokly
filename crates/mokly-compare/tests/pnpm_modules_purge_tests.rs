//! Real pnpm versions recreate a tracked modules directory without a prompt.

#![cfg(unix)]

use std::env;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;
use std::time::Duration;

use mokly_compare::cache_types::Cache;
use mokly_compare::commands::{Commands, TimedCommands};
use mokly_compare::dependencies::{Dependencies, DependencyTiers};
use mokly_compare::dependency_types::{Request, Tier};
use mokly_compare::extraction::{CachedExtraction, Extraction};
use mokly_compare::inputs::{InputReader, SourceInputs};
use mokly_compare::process::SystemSpawner;
use mokly_compare::sources::{GitSources, Sources};
use mokly_git::control::{SystemClock, Token};
use mokly_git::disk::SystemDisk;
use mokly_git::identity::{ObjectId, RepoPath};
use mokly_git::repository::{GitRepositories, Repositories};
use mokly_git::system::SystemRunner;
use mokly_git::tree::Limits;
use mokly_platform::processes::SystemProcessGroups;
use mokly_sidecar::methods::ModuleResolution;

use support::{cache, git, storage};

#[expect(
    dead_code,
    reason = "The support module also serves cache integration tests."
)]
mod support;

const VERSION_ENV: &str = "MOKLY_PNPM_PURGE_VERSION";
const CI_ENV: &str = "MOKLY_PNPM_PURGE_CI";
const ACTIONS_ENV: &str = "MOKLY_PNPM_PURGE_ACTIONS";

#[test]
fn pnpm_versions_recreate_tracked_modules_without_a_tty_prompt() {
    let versions = [
        ("10.34.7", "pnpm/bin/pnpm.cjs"),
        ("11.20.0", "pnpm-modern/bin/pnpm.mjs"),
        ("12.14.0", "pnpm-native/bin/pnpm.mjs"),
    ];
    let Some(version) = env::var_os(VERSION_ENV) else {
        let launchers = tempfile::tempdir().unwrap();
        for (version, relative_cli) in versions {
            let cli = cli_path(relative_cli);
            assert!(
                cli.is_file(),
                "Pinned pnpm {version} CLI is missing at {}; run npm ci",
                cli.display()
            );
            let bin = launchers.path().join(version);
            fs::create_dir(&bin).unwrap();
            write_launcher(&bin.join("pnpm"), &cli);
            let path = manager_path(&bin);
            for (ci, actions) in [(false, false), (true, false), (false, true), (true, true)] {
                let mut child = Command::new(env::current_exe().unwrap());
                child
                    .args([
                        "--exact",
                        "pnpm_versions_recreate_tracked_modules_without_a_tty_prompt",
                        "--nocapture",
                    ])
                    .env(VERSION_ENV, version)
                    .env(CI_ENV, if ci { "true" } else { "false" })
                    .env(ACTIONS_ENV, if actions { "true" } else { "false" })
                    .env("PATH", &path);
                if ci {
                    child.env("CI", "true");
                } else {
                    child.env_remove("CI");
                }
                if actions {
                    child.env("GITHUB_ACTIONS", "true");
                } else {
                    child.env_remove("GITHUB_ACTIONS");
                }
                let output = child.output().unwrap();
                assert!(
                    output.status.success(),
                    "pnpm {version} with CI={ci} GITHUB_ACTIONS={actions} failed:\n{}\n{}",
                    String::from_utf8_lossy(&output.stdout),
                    String::from_utf8_lossy(&output.stderr)
                );
            }
        }
        return;
    };

    let ci = env::var_os(CI_ENV).is_some_and(|value| value == "true");
    let actions = env::var_os(ACTIONS_ENV).is_some_and(|value| value == "true");
    run_install(&version.to_string_lossy(), ci, actions);
}

fn cli_path(relative: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join("node_modules")
        .join(relative)
}

fn write_launcher(path: &Path, cli: &Path) {
    let url = format!("file://{}", cli.display());
    fs::write(
        path,
        format!("#!/usr/bin/env node\nvoid import({url:?});\n"),
    )
    .unwrap();
    fs::set_permissions(path, fs::Permissions::from_mode(0o755)).unwrap();
}

fn manager_path(bin: &Path) -> String {
    let mut paths = vec![bin.to_owned()];
    paths.extend(
        env::split_paths(&env::var_os("PATH").unwrap_or_default())
            .filter(|path| path.is_absolute()),
    );
    env::join_paths(paths)
        .unwrap()
        .to_string_lossy()
        .into_owned()
}

fn run_install(version: &str, _ci: bool, _actions: bool) {
    let temporary = tempfile::tempdir().unwrap();
    let root = dunce::canonicalize(temporary.path())
        .unwrap()
        .join("repository");
    fs::create_dir(&root).unwrap();
    git(&root, &["init", "-b", "main"]);
    git(&root, &["config", "core.autocrlf", "false"]);
    git(&root, &["config", "user.name", "Mokly Tests"]);
    git(&root, &["config", "user.email", "tests@mokly.invalid"]);
    write(&root, "package.json", package_json(version));
    write(
        &root,
        "dep/package.json",
        br#"{"name":"dep","version":"1.0.0","main":"index.js"}"#,
    );
    write(&root, "dep/index.js", b"module.exports = 'dep';\n");
    write(&root, "pnpm-lock.yaml", lockfile());
    write(&root, "node_modules/.modules.yaml", b"{}\n");
    write(&root, "node_modules/.pnpm/lock.yaml", b"{}\n");
    git(&root, &["add", "-A"]);
    git(&root, &["commit", "-m", "pnpm purge fixture"]);
    let commit =
        ObjectId::parse(String::from_utf8_lossy(&git(&root, &["rev-parse", "HEAD"])).trim())
            .unwrap();

    let token = Arc::new(Token::default());
    let clock = Arc::new(SystemClock::default());
    let groups = Arc::new(SystemProcessGroups);
    let repositories: &dyn Repositories = &GitRepositories {
        runner: Arc::new(SystemRunner {
            groups: groups.clone(),
            cancellation: token.clone(),
            clock: clock.clone(),
        }),
        disk: Arc::new(SystemDisk),
    };
    let repository = repositories.open(&root).unwrap();
    let sources: &dyn Sources =
        &GitSources::new(Arc::clone(&repository), commit.clone(), Limits::default());
    let base = SourceInputs.read(sources, Limits::default()).unwrap();
    let cache: Arc<dyn Cache> = Arc::new(cache(
        dunce::canonicalize(temporary.path()).unwrap().join("cache"),
        10 * 1024 * 1024,
    ));
    let extraction: &dyn Extraction = &CachedExtraction {
        repository,
        cache: Arc::clone(&cache),
        files: Limits::default().files,
    };
    let source = extraction.acquire(&commit).unwrap();
    let commands: Arc<dyn Commands> = Arc::new(TimedCommands {
        spawner: Arc::new(SystemSpawner { groups }),
        clock: clock.clone(),
        cancellation: token,
        storage: storage(temporary.path()),
    });
    let request = Request {
        base,
        head: Default::default(),
        source_root: source.directory,
        unmapped_directories: vec![],
        used_directories: vec![],
        install_scripts: false,
        source_identity: commit.as_str().to_owned(),
        head_root: root,
        configuration: RepoPath::parse("mokly.config.json").unwrap(),
        resolution: ModuleResolution::default(),
    };
    let resolved = DependencyTiers {
        cache,
        commands,
        storage: storage(temporary.path()),
        clock,
        timeout: Duration::from_secs(120),
        install_bytes: 10 * 1024 * 1024,
    }
    .resolve(&request)
    .unwrap();
    assert_eq!(
        resolved.tier,
        Tier::Installed,
        "pnpm {version}: {:?}",
        resolved.warning
    );
}

fn package_json(version: &str) -> &'static [u8] {
    match version {
        "10.34.7" => br#"{"name":"app","version":"1.0.0","packageManager":"pnpm@10.34.7","dependencies":{"dep":"file:dep"}}"#,
        "11.20.0" => br#"{"name":"app","version":"1.0.0","packageManager":"pnpm@11.20.0","dependencies":{"dep":"file:dep"}}"#,
        "12.14.0" => br#"{"name":"app","version":"1.0.0","packageManager":"pnpm@12.14.0","dependencies":{"dep":"file:dep"}}"#,
        _ => unreachable!(),
    }
}

fn lockfile() -> &'static [u8] {
    br#"lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

importers:

  .:
    dependencies:
      dep:
        specifier: file:dep
        version: file:dep

packages:

  dep@file:dep:
    resolution: {directory: dep, type: directory}

snapshots:

  dep@file:dep: {}
"#
}

fn write(root: &Path, path: &str, bytes: &[u8]) {
    let path = root.join(path);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, bytes).unwrap();
}
