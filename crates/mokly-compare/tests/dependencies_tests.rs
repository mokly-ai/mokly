//! Real base blobs, extraction and a registry-free local npm installation.

use std::fs;
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

use mokly_compare::cache_types::Cache;
use mokly_compare::commands::{Command, Commands, TimedCommands};
use mokly_compare::dependencies::{Dependencies, DependencyTiers, Request, Tier};
use mokly_compare::extraction::{CachedExtraction, Extraction};
use mokly_compare::inputs::{InputReader, SourceInputs};
use mokly_compare::process::SystemSpawner;
use mokly_compare::sources::{GitSources, Sources};
use mokly_compare::working_inputs::{SystemWorkingInputs, WorkingInputs};
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

fn write(root: &Path, path: &str, bytes: &[u8]) {
    let path = root.join(path);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, bytes).unwrap();
}

#[test]
fn local_dependencies_install_without_network_or_lifecycle_scripts_and_reuse_the_cache() {
    let temporary = tempfile::tempdir().unwrap();
    let root = temporary.path().canonicalize().unwrap().join("repository");
    fs::create_dir(&root).unwrap();
    git(&root, &["init", "-b", "main"]);
    git(&root, &["config", "user.name", "Mokly Tests"]);
    git(&root, &["config", "user.email", "tests@mokly.invalid"]);
    write(&root, ".npmrc", b"offline=true\nupdate-notifier=false\n");
    write(&root, ".gitignore", b"node_modules\n.npm-cache\n");
    write(&root, "package.json", br#"{"name":"base-fixture","version":"1.0.0","dependencies":{"local-fixture":"file:packages/local"},"scripts":{"preinstall":"node -e \"require('node:fs').writeFileSync('script-ran','bad')\""}}"#);
    write(&root, "packages/local/package.json", br#"{"name":"local-fixture","version":"1.0.0","main":"index.js","scripts":{"install":"node -e \"require('node:fs').writeFileSync('dependency-script-ran','bad')\""}}"#);
    write(
        &root,
        "packages/local/index.js",
        b"module.exports = 'base';\n",
    );
    write(&root, "specs/file.html", b"<p>Base</p>");
    let token = Arc::new(Token::default());
    let clock = Arc::new(SystemClock::default());
    let groups = Arc::new(SystemProcessGroups);
    let commands: Arc<dyn Commands> = Arc::new(TimedCommands {
        spawner: Arc::new(SystemSpawner {
            groups: groups.clone(),
        }),
        clock: clock.clone(),
        cancellation: token.clone(),
        storage: storage(),
    });
    commands
        .run(&Command {
            program: "npm".into(),
            args: [
                "install",
                "--package-lock-only",
                "--ignore-scripts",
                "--offline",
                "--no-audit",
                "--no-fund",
                "--cache",
                ".npm-cache",
            ]
            .map(Into::into)
            .to_vec(),
            directory: root.clone(),
            timeout: Duration::from_secs(120),
            byte_limit: None,
        })
        .unwrap();
    let outside_logs = temporary.path().join("outside-npm-logs");
    write(
        &root,
        ".npmrc",
        format!(
            "offline=true\nupdate-notifier=false\nlogs-dir={}\n",
            outside_logs.display()
        )
        .as_bytes(),
    );
    git(&root, &["add", "-A"]);
    git(&root, &["commit", "-m", "base fixture"]);
    let commit =
        ObjectId::parse(String::from_utf8_lossy(&git(&root, &["rev-parse", "HEAD"])).trim())
            .unwrap();
    let repositories: &dyn Repositories = &GitRepositories {
        runner: Arc::new(SystemRunner {
            groups: groups.clone(),
            cancellation: token.clone(),
            clock: clock.clone(),
        }),
        disk: Arc::new(SystemDisk),
    };
    let repository = repositories.open(&root).unwrap();
    let sources: &dyn Sources = &GitSources {
        repository: Arc::clone(&repository),
        commit: commit.clone(),
    };
    let reader: &dyn InputReader = &SourceInputs;
    let base = reader.read(sources, Limits::default()).unwrap();
    let working: &dyn WorkingInputs = &SystemWorkingInputs;
    let head = working.read(&root, Limits::default()).unwrap();
    assert_eq!(base, head);
    let cache: Arc<dyn Cache> = Arc::new(cache(
        temporary.path().canonicalize().unwrap().join("cache"),
        10 * 1024 * 1024,
    ));
    let extraction: &dyn Extraction = &CachedExtraction {
        repository,
        cache: Arc::clone(&cache),
        limits: Limits::default(),
    };
    let source = extraction.acquire(&commit).unwrap();
    assert_eq!(
        fs::read(source.directory.join("specs/file.html")).unwrap(),
        b"<p>Base</p>"
    );
    let tiers: &dyn Dependencies = &DependencyTiers {
        cache,
        commands,
        storage: storage(),
        timeout: Duration::from_secs(120),
        install_bytes: 10 * 1024 * 1024,
    };
    let mut request = Request {
        base,
        head,
        source_root: source.directory.clone(),
        source_identity: commit.as_str().to_owned(),
        head_root: root.clone(),
        configuration: RepoPath::parse("mokly.config.json").unwrap(),
        resolution: ModuleResolution::default(),
    };
    assert_eq!(tiers.resolve(&request).unwrap().tier, Tier::Working);
    request
        .head
        .files
        .remove(&RepoPath::parse("package-lock.json").unwrap());
    let first_directory = {
        let result = tiers.resolve(&request).unwrap();
        assert_eq!(result.tier, Tier::Installed, "{:?}", result.warning);
        assert!(
            !outside_logs.exists(),
            "npm logs escaped the bounded install directory"
        );
        assert_eq!(
            fs::read(result.node_modules.join("local-fixture/index.js")).unwrap(),
            b"module.exports = 'base';\n"
        );
        assert!(
            !result
                .lease
                .as_ref()
                .unwrap()
                .directory
                .join("script-ran")
                .exists()
        );
        assert!(
            !result
                .lease
                .as_ref()
                .unwrap()
                .directory
                .join("packages/local/dependency-script-ran")
                .exists()
        );
        result.node_modules
    };
    let result = tiers.resolve(&request).unwrap();
    assert_eq!(result.tier, Tier::Installed);
    assert_eq!(result.node_modules, first_directory);
    assert!(
        result.module_resolution.package_roots[0].starts_with(temporary.path().to_str().unwrap())
    );
    assert!(!root.join("node_modules").exists());
}
