//! Real Git and render-graph composition for comparison integration fixtures.

use std::fs;
use std::path::Path;
use std::process::Command;
use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::definition_provider::DeferredDefinitions;
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_compare::comparison::Engine;
use mokly_compare::comparison_types::{Comparison, ComparisonRequest, ComparisonResult};
use mokly_compare::error::{Error, Result};
use mokly_compare::git_tree::GitTree;
use mokly_compare::move_types::MoveDetector;
use mokly_compare::moves::Detector;
use mokly_compare::sources::GitSources;
use mokly_css::compiler::Compiler;
use mokly_css::parsed_cache::{MemoryParsedCss, ParsedCssCache};
use mokly_css::resolver::SourceResolver;
use mokly_css::types::IdentityProcessor;
use mokly_git::control::{SystemClock, Token};
use mokly_git::disk::SystemDisk;
use mokly_git::identity::ObjectId;
use mokly_git::repository::{GitRepositories, Repositories};
use mokly_git::system::SystemRunner;
use mokly_git::tree::Limits;
use mokly_graph::cache::{MemoryCache, RenderCache};
use mokly_graph::graph::Graph;
use mokly_graph::source_snapshot::SourceSnapshot;
use mokly_graph::types::{RenderGeneration, RenderGraph};
use mokly_graph::workers::ThreadWorkers;
use mokly_html::composition::HtmlComposer;
use mokly_html::fragment::DeferredFragments;
use mokly_model::review::ReviewEntry;
use mokly_platform::processes::SystemProcessGroups;
use mokly_source_interface::tree::SourceTree;
use tempfile::TempDir;

pub struct Fixture {
    pub directory: TempDir,
    commit: ObjectId,
    cache: Arc<dyn RenderCache>,
}

impl Fixture {
    pub fn new(files: &[(&str, &str)]) -> Self {
        let directory = TempDir::new().unwrap();
        write(directory.path(), "mokly.config.json", "{}");
        for (path, text) in files {
            write(directory.path(), path, text);
        }
        git(directory.path(), &["init", "--initial-branch=fixture-base"]);
        git(directory.path(), &["add", "."]);
        git(
            directory.path(),
            &[
                "-c",
                "user.name=Fixture",
                "-c",
                "user.email=fixture@example.test",
                "commit",
                "-m",
                "fixture base",
            ],
        );
        let commit = ObjectId::parse(
            String::from_utf8(git(directory.path(), &["rev-parse", "HEAD"]))
                .unwrap()
                .trim(),
        )
        .unwrap();
        Self {
            directory,
            commit,
            cache: Arc::new(MemoryCache::new(4 * 1024 * 1024)),
        }
    }

    pub fn edit(&self, path: &str, text: &str) {
        write(self.directory.path(), path, text);
    }
    pub fn remove(&self, path: &str) {
        fs::remove_file(self.directory.path().join(path)).unwrap();
    }
    pub fn relocate(&self, before: &str, after: &str) {
        let destination = self.directory.path().join(after);
        fs::create_dir_all(destination.parent().unwrap()).unwrap();
        fs::rename(self.directory.path().join(before), destination).unwrap();
    }

    pub fn compare(&self) -> Result<ComparisonResult> {
        self.compare_with(
            Arc::new(Detector),
            Arc::new(MemoryParsedCss::new(1024 * 1024)),
        )
    }

    pub fn compare_with(
        &self,
        moves: Arc<dyn MoveDetector>,
        css: Arc<dyn ParsedCssCache>,
    ) -> Result<ComparisonResult> {
        let repositories: &dyn Repositories = &GitRepositories {
            runner: Arc::new(SystemRunner {
                groups: Arc::new(SystemProcessGroups),
                clock: Arc::new(SystemClock::default()),
                cancellation: Arc::new(Token::default()),
            }),
            disk: Arc::new(SystemDisk),
        };
        let repository = repositories.open(self.directory.path()).unwrap();
        let base_tree: Arc<dyn SourceTree> = Arc::new(GitTree::new(
            self.directory.path().into(),
            Arc::new(GitSources::new(
                repository,
                self.commit.clone(),
                Limits::default(),
            )),
            48 * 1024 * 1024,
        ));
        let before = prepare(self.directory.path(), base_tree, self.cache.clone())?;
        let after = prepare(
            self.directory.path(),
            Arc::new(WorkingTree),
            self.cache.clone(),
        )?;
        let engine: &dyn Comparison = &Engine { moves, css };
        engine.compare(
            &ComparisonRequest {
                base_ref: "fixture-base".into(),
                base_commit: self.commit.to_string(),
                catalogue_identity: "a".repeat(64),
            },
            before,
            after,
        )
    }
}

fn prepare(
    root: &Path,
    tree: Arc<dyn SourceTree>,
    cache: Arc<dyn RenderCache>,
) -> Result<Arc<dyn RenderGeneration>> {
    let tree: Arc<dyn SourceTree> = Arc::new(SourceSnapshot::new(tree));
    let config = Loader { tree: tree.clone() }
        .load(root, None)
        .map_err(|source| Error::Catalogue { source })?;
    let catalogue = Builder {
        tree: tree.clone(),
        discovery: Arc::new(Discoverer { tree: tree.clone() }),
        definitions: Arc::new(DeferredDefinitions),
    }
    .prepare(&config, None)
    .map_err(|source| Error::Catalogue { source })?;
    let graph: &dyn RenderGraph = &Graph {
        inputs: Default::default(),
        tree: tree.clone(),
        composer: Arc::new(HtmlComposer {
            fragments: Arc::new(DeferredFragments),
        }),
        stylesheets: Arc::new(Compiler {
            tree: tree.clone(),
            repo_root: config.repo_root.clone(),
            resolver: Arc::new(SourceResolver {
                tree,
                repo_root: config.repo_root.clone(),
                settings: Default::default(),
            }),
            processor: Arc::new(IdentityProcessor),
        }),
        cache,
        workers: Arc::new(ThreadWorkers::new(1).unwrap()),
        version: "fixture".into(),
    };
    graph
        .prepare(config, catalogue, None)
        .map_err(|source| Error::Graph { source })
}

pub fn entry<'a>(result: &'a ComparisonResult, path: &str) -> &'a ReviewEntry {
    result
        .review
        .entries
        .iter()
        .chain(
            result
                .review
                .entries
                .iter()
                .flat_map(|entry| entry.variants.iter().flatten()),
        )
        .find(|entry| entry.path == path)
        .unwrap_or_else(|| panic!("missing {path}"))
}

fn write(root: &Path, path: &str, text: &str) {
    let path = root.join(path);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, text).unwrap();
}

fn git(root: &Path, args: &[&str]) -> Vec<u8> {
    let output = Command::new("git")
        .current_dir(root)
        .args(args)
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env(
            "GIT_CONFIG_GLOBAL",
            if cfg!(windows) { "NUL" } else { "/dev/null" },
        )
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{args:?}: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    output.stdout
}
