//! Real head, extracted base, and pinned Git sources share the production runtime services.

use std::process::Command;
use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_compare::cache_types::Lease;
use mokly_compare::dependency_types::{Resolved, Tier};
use mokly_compare::git_tree::GitTree;
use mokly_compare::sources::GitSources;
use mokly_git::control::{SystemClock, Token};
use mokly_git::disk::SystemDisk;
use mokly_git::identity::ObjectId;
use mokly_git::repository::{GitRepositories, Repositories, Repository};
use mokly_git::system::SystemRunner;
use mokly_git::tree::Limits;
use mokly_graph::error::Result;
use mokly_graph::types::{GraphFactory, RenderGeneration};
use mokly_platform::locks::{FileLock, Locks, SystemLocks};
use mokly_platform::processes::SystemProcessGroups;
use mokly_render::runtime::Runtime;
use mokly_render::side::BaseSide;
use mokly_sidecar::methods::ModuleResolution;
use mokly_test_support::capture::Trace;

use super::support::{Consumer, package_version};

pub(super) const CSS: &str = ".equal {\n  --selection: equal;\n}\n";

struct Extraction {
    _directory: tempfile::TempDir,
    _lock: Box<dyn FileLock>,
}
impl FileLock for Extraction {}

pub(super) struct Fixture {
    pub(super) head: Consumer,
    repository: Arc<dyn Repository>,
    commit: ObjectId,
}

impl Fixture {
    pub(super) fn new() -> Self {
        Self::with_files(&[])
    }

    pub(super) fn with_files(files: &[(&str, &str)]) -> Self {
        Self::with_setup(files, &|_| {})
    }

    pub(super) fn with_setup(files: &[(&str, &str)], setup: &dyn Fn(&Consumer)) -> Self {
        let head = Consumer::single();
        head.write(".gitignore", "node_modules/\n");
        head.write("mokly.config.json", r#"{"roots":[{"dir":"specs","files":["**/*.screen.html"]}],"stylesheets":[{"match":"**","stylesheets":["main.css"]}]}"#);
        head.write(
            "specs/mixed.screen.html",
            "---\ntitle: Equal\n---\n<p class=equal>Equal</p>\n",
        );
        head.write("main.css", "@import './tokens.css';\n");
        head.write("tokens.css", CSS);
        for (path, text) in files {
            head.write(path, text);
        }
        setup(&head);
        git(&head, &["init", "--initial-branch=fixture-base"]);
        git(&head, &["add", "-A"]);
        git(
            &head,
            &[
                "-c",
                "user.name=Fixture",
                "-c",
                "user.email=fixture@mokly.invalid",
                "commit",
                "-m",
                "fixture base",
            ],
        );
        let commit = ObjectId::parse(
            String::from_utf8(git(&head, &["rev-parse", "HEAD"]))
                .unwrap()
                .trim(),
        )
        .unwrap();
        let repositories: &dyn Repositories = &GitRepositories {
            runner: Arc::new(SystemRunner {
                groups: Arc::new(SystemProcessGroups),
                clock: Arc::new(SystemClock::default()),
                cancellation: Arc::new(Token::default()),
            }),
            disk: Arc::new(SystemDisk),
        };
        let repository = repositories.open(head.root()).unwrap();
        Self {
            head,
            repository,
            commit,
        }
    }

    pub(super) fn base_runtime(&self, shared: bool) -> Arc<Runtime> {
        let root = self.head.repository();
        let temporary = tempfile::tempdir().unwrap();
        let directory = temporary.path().join("sources");
        self.repository
            .extract(&self.commit, &directory, Limits::default())
            .unwrap();
        let lock = SystemLocks
            .try_lock(&temporary.path().join("entry.lock"))
            .unwrap();
        let config = self.head.config();
        let authored = config.input.module_resolution.clone().unwrap_or_default();
        let side = Arc::new(BaseSide {
            working_root: root.clone(),
            sources: Arc::new(Lease {
                directory,
                guard: Box::new(Extraction {
                    _directory: temporary,
                    _lock: lock,
                }),
            }),
            dependencies: Resolved {
                tier: Tier::Working,
                node_modules: root.join("node_modules"),
                module_resolution: ModuleResolution {
                    dependency_root: Some(root.to_string_lossy().into_owned()),
                    package_roots: mokly_compare::ancestor_roots::package_roots(
                        "",
                        config.package_roots(),
                    )
                    .into_iter()
                    .map(|path| {
                        (if path.is_empty() {
                            root.clone()
                        } else {
                            root.join(path)
                        })
                        .to_string_lossy()
                        .into_owned()
                    })
                    .collect(),
                    aliases: authored.aliases.unwrap_or_default(),
                    conditions: authored.conditions.unwrap_or_default(),
                    main_fields: authored.main_fields.unwrap_or_default(),
                    resolve_extensions: authored.resolve_extensions.unwrap_or_default(),
                    ..Default::default()
                },
                warning: None,
                lease: None,
                repository_roots: vec![root.clone()],
            },
            cache_namespace: None,
            identity: self.commit.to_string(),
        });
        let tree = Arc::new(GitTree::new(
            root,
            Arc::new(GitSources::new(
                self.repository.clone(),
                self.commit.clone(),
                Limits::default(),
            )),
            1024 * 1024,
        ));
        Arc::new(if shared {
            self.head
                .runtime
                .for_base(tree, package_version::read(), Some(side))
        } else {
            Runtime::new(
                tree,
                Arc::new(WorkingTree),
                self.head.runtime.physical_inputs.clone(),
                self.head.pool.clone(),
                self.head.runtime.cache.clone(),
                self.head.runtime.workers.clone(),
                package_version::read(),
                Some(side),
            )
        })
    }
}

pub(super) fn generation(
    runtime: &Arc<Runtime>,
    head: &Consumer,
) -> (Arc<dyn RenderGeneration>, Vec<String>) {
    let (generation, misses) = try_generation(runtime, head);
    (generation.unwrap(), misses)
}

pub(super) fn try_generation(
    runtime: &Arc<Runtime>,
    head: &Consumer,
) -> (Result<Arc<dyn RenderGeneration>>, Vec<String>) {
    let trace = Trace::default();
    let generation = trace.in_scope(|| {
        let tree = runtime.tree.clone();
        let loader: &dyn ConfigLoader = &Loader { tree: tree.clone() };
        let config = loader.load(head.root(), None).unwrap();
        let builder: &dyn CatalogueBuilder = &Builder {
            tree: tree.clone(),
            discovery: Arc::new(Discoverer { tree }),
            definitions: runtime.clone(),
        };
        let prepared = builder.prepare(&config, None).unwrap();
        let factory: &dyn GraphFactory = runtime.as_ref();
        factory
            .create(&config)
            .unwrap()
            .prepare(config, prepared, None)
    });
    let misses = trace
        .spans()
        .into_iter()
        .filter(|span| span.name == "css.bundle")
        .map(|span| span.fields["cache"].clone())
        .collect();
    (generation, misses)
}

fn git(head: &Consumer, arguments: &[&str]) -> Vec<u8> {
    let output = Command::new("git")
        .args(arguments)
        .current_dir(head.root())
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    output.stdout
}
