//! Registry-free installs at independent configured package roots.

use std::fs;
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

use mokly_compare::cache_types::Cache;
use mokly_compare::commands::{Command, Commands, TimedCommands};
use mokly_compare::dependencies::{Dependencies, DependencyTiers};
use mokly_compare::dependency_types::{Request, Tier};
use mokly_compare::inputs::{InputReader, SourceInputs};
use mokly_compare::overlay::CachedOverlays;
use mokly_compare::process::SystemSpawner;
use mokly_compare::sources::GitSources;
use mokly_git::control::{SystemClock, Token};
use mokly_git::disk::SystemDisk;
use mokly_git::identity::{ObjectId, RepoPath};
use mokly_git::repository::{GitRepositories, Repositories};
use mokly_git::system::SystemRunner;
use mokly_git::tree::Limits;
use mokly_platform::processes::SystemProcessGroups;
use mokly_sidecar::methods::ModuleResolution;

use support::{cache, git, storage};

#[expect(dead_code, reason = "Host fixtures also serve cache tests.")]
mod support;

fn write(root: &Path, path: &str, bytes: &[u8]) {
    let target = root.join(path);
    fs::create_dir_all(target.parent().unwrap()).unwrap();
    fs::write(target, bytes).unwrap();
}

#[test]
fn frontend_installs_with_or_without_an_independent_root_install() {
    for with_root in [false, true] {
        let temporary = tempfile::tempdir().unwrap();
        let root = temporary.path().canonicalize().unwrap().join("repository");
        fs::create_dir(&root).unwrap();
        git(&root, &["init", "-b", "main"]);
        git(&root, &["config", "user.name", "Mokly Tests"]);
        git(&root, &["config", "user.email", "tests@mokly.invalid"]);
        write(&root, ".gitignore", b"node_modules\n.npm-cache\n");
        let clock = Arc::new(SystemClock::default());
        let token = Arc::new(Token::default());
        let groups = Arc::new(SystemProcessGroups);
        let commands: Arc<dyn Commands> = Arc::new(TimedCommands {
            spawner: Arc::new(SystemSpawner {
                groups: groups.clone(),
            }),
            clock: clock.clone(),
            cancellation: token.clone(),
            storage: storage(temporary.path()),
        });
        let roots = if with_root {
            vec!["", "frontend"]
        } else {
            vec!["frontend"]
        };
        for package_root in &roots {
            let prefix = if package_root.is_empty() {
                String::new()
            } else {
                format!("{package_root}/")
            };
            let name = if package_root.is_empty() {
                "local-root"
            } else {
                "local-front"
            };
            write(&root, &format!("{prefix}package.json"), format!("{{\"name\":\"independent-app\",\"version\":\"1.0.0\",\"dependencies\":{{\"{name}\":\"file:vendor/local\"}}}}").as_bytes());
            write(
                &root,
                &format!("{prefix}vendor/local/package.json"),
                format!("{{\"name\":\"{name}\",\"version\":\"1.0.0\",\"main\":\"index.js\"}}")
                    .as_bytes(),
            );
            write(
                &root,
                &format!("{prefix}vendor/local/index.js"),
                b"module.exports='base';",
            );
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
                    directory: root.join(package_root),
                    timeout: Duration::from_secs(120),
                    byte_limit: None,
                    size_root: None,
                })
                .unwrap();
        }
        git(&root, &["add", "-A"]);
        git(&root, &["commit", "-m", "apps"]);
        let commit =
            ObjectId::parse(String::from_utf8_lossy(&git(&root, &["rev-parse", "HEAD"])).trim())
                .unwrap();
        let factory: &dyn Repositories = &GitRepositories {
            runner: Arc::new(SystemRunner {
                groups,
                clock: clock.clone(),
                cancellation: token,
            }),
            disk: Arc::new(SystemDisk),
        };
        let repository = factory.open(&root).unwrap();
        let base = SourceInputs
            .read(
                &GitSources::new(repository.clone(), commit.clone()),
                Limits::default(),
            )
            .unwrap();
        let cache: Arc<dyn Cache> = Arc::new(cache(
            temporary.path().canonicalize().unwrap().join("cache"),
            10 * 1024 * 1024,
        ));
        let extraction = mokly_compare::extraction::CachedExtraction {
            repository,
            cache: cache.clone(),
            files: 10000,
            blob_bytes: 1024 * 1024,
        };
        let sources = mokly_compare::extraction::Extraction::acquire(&extraction, &commit).unwrap();
        let tiers: &dyn Dependencies = &DependencyTiers {
            cache: cache.clone(),
            overlays: Arc::new(CachedOverlays {
                cache,
                storage: storage(temporary.path()),
            }),
            storage: storage(temporary.path()),
            clock,
            commands,
            timeout: Duration::from_secs(120),
            install_bytes: 10 * 1024 * 1024,
        };
        let result = tiers
            .resolve(&Request {
                base,
                head: Default::default(),
                source_root: sources.directory,
                source_identity: commit.to_string(),
                head_root: root,
                configuration: RepoPath::parse("mokly.config.json").unwrap(),
                resolution: ModuleResolution {
                    package_roots: vec!["frontend".into()],
                    ..Default::default()
                },
            })
            .unwrap();
        assert_eq!(result.tier, Tier::Installed, "{:?}", result.warning);
        let installed = &result.lease.as_ref().unwrap().directory;
        assert!(
            installed
                .join("frontend/node_modules/local-front/index.js")
                .is_file()
        );
        if with_root {
            assert!(installed.join("node_modules/local-root/index.js").is_file());
        }
    }
}
