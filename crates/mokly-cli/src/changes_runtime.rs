//! Comparison uses the command's shared sidecar pool, cache, and cancellation graph.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_cli::build::BuildError;
use mokly_cli::cancellation::Cancellation;
use mokly_cli::grammar::Build;
use mokly_cli::output::{Mode, Style, bounded};
use mokly_cli::redaction::Redactor;
use mokly_cli::static_build::{Phase, Phases};
use mokly_compare::base_render::{Changes, ChangesService, GitSourceFactory, selected_base};
use mokly_compare::base_selection::{BaseLookup, GitBaseLookup, PinnedBase};
use mokly_compare::cache_types::Reporter;
use mokly_compare::comparison::Engine;
use mokly_compare::comparison_types::ComparisonResult;
use mokly_compare::error::Result;
use mokly_compare::extraction_snapshots::ProcessSnapshots;
use mokly_compare::locations::{OnceReporter, plain_line};
use mokly_compare::moves::Detector;
use mokly_css::parsed_cache::MemoryParsedCss;
use mokly_git::control::{self, SystemClock, Token};
use mokly_git::disk::SystemDisk;
use mokly_git::repository::{GitRepositories, Repositories};
use mokly_git::system::SystemRunner;
use mokly_git::tree::Limits;
use mokly_graph::types::RenderGeneration;
use mokly_platform::processes::SystemProcessGroups;
use mokly_render::runtime::Runtime;
use mokly_static::fingerprint::InputTree;

use crate::base_dependencies::NativeDependencies;
use crate::changes_base::NativeBase;
use crate::changes_static::StaticBase;

#[expect(
    clippy::too_many_arguments,
    reason = "the composition root passes independent runtime seams"
)]
pub(super) fn service(
    runtime: Arc<Runtime>,
    inputs: Arc<dyn InputTree>,
    cancellation: Arc<dyn Cancellation>,
    pinned: Option<Arc<PinnedBase>>,
    style: Style,
    redactor: Arc<Redactor>,
    phases: Arc<dyn Phases>,
    install_scripts: Option<bool>,
) -> Arc<dyn ChangesService> {
    let token: Arc<dyn control::Cancellation> = Arc::new(GitCancellation {
        command: cancellation.clone(),
        token: Token::default(),
    });
    let reporter: Arc<dyn Reporter> = Arc::new(OnceReporter {
        announced: false.into(),
        reporter: Arc::new(CacheReporter {
            phases: phases.clone(),
            style,
            redactor,
        }),
    });
    let changes = Arc::new(Changes {
        lookup: Arc::new(GitBaseLookup {
            repositories: repositories(token.clone()),
        }),
        pinned,
        sources: Arc::new(GitSourceFactory {
            limits: Limits::default(),
            batch_bytes: 48 * 1024 * 1024,
            snapshots: Arc::new(ProcessSnapshots::default()),
        }),
        provider: Arc::new(StaticBase {
            inputs,
            inner: Arc::new(NativeBase {
                runtime,
                cancellation,
                dependencies: Arc::new(NativeDependencies {
                    cancellation: token,
                    reporter,
                }),
            }),
        }),
        comparison: Arc::new(Engine {
            moves: Arc::new(Detector),
            css: Arc::new(MemoryParsedCss::new(64 * 1024 * 1024)),
        }),
    });
    Arc::new(PhasedChanges {
        changes,
        phases,
        install_scripts,
    })
}

pub(super) fn pin(
    config: &ResolvedConfig,
    options: &Build,
    cancellation: Arc<dyn Cancellation>,
) -> std::result::Result<Option<Arc<PinnedBase>>, BuildError> {
    if options.no_changes {
        return Ok(None);
    }
    let base = selected_base(config, options.common.base.as_deref()).to_owned();
    let token: Arc<dyn control::Cancellation> = Arc::new(GitCancellation {
        command: cancellation,
        token: Token::default(),
    });
    let lookup: &dyn BaseLookup = &GitBaseLookup {
        repositories: repositories(token),
    };
    match lookup.pin(&config.repo_root, &base) {
        Ok(pinned) => Ok(Some(pinned)),
        Err(mokly_compare::error::Error::Git { source }) => Err(BuildError::Git { base, source }),
        Err(source) => Err(BuildError::Comparison {
            base_ref: base,
            source: Box::new(source),
            warnings: Vec::new(),
        }),
    }
}

fn repositories(token: Arc<dyn control::Cancellation>) -> Arc<dyn Repositories> {
    Arc::new(GitRepositories {
        runner: Arc::new(SystemRunner {
            clock: Arc::new(SystemClock::default()),
            cancellation: token,
            groups: Arc::new(SystemProcessGroups),
        }),
        disk: Arc::new(SystemDisk),
    })
}

struct PhasedChanges {
    changes: Arc<dyn ChangesService>,
    phases: Arc<dyn Phases>,
    install_scripts: Option<bool>,
}
impl ChangesService for PhasedChanges {
    fn capture_head(&self, head: Arc<dyn RenderGeneration>) -> Result<Arc<dyn RenderGeneration>> {
        self.changes.capture_head(head)
    }

    fn classify(
        &self,
        config: &ResolvedConfig,
        base: Option<&str>,
        head: Arc<dyn RenderGeneration>,
        _: Option<bool>,
    ) -> Result<ComparisonResult> {
        self.phases
            .start(Phase::Comparing(selected_base(config, base).into()));
        self.changes
            .classify(config, base, head, self.install_scripts)
    }
}

struct GitCancellation {
    command: Arc<dyn Cancellation>,
    token: Token,
}
impl control::Cancellation for GitCancellation {
    fn cancelled(&self) -> bool {
        if self.command.requested() {
            self.token.cancel();
        }
        self.token.cancelled()
    }
}

struct CacheReporter {
    phases: Arc<dyn Phases>,
    style: Style,
    redactor: Arc<Redactor>,
}
impl Reporter for CacheReporter {
    fn opened(&self, directory: &Path) {
        self.phases
            .note(&cache_line(directory, &self.style, &self.redactor));
    }
}

/// Format the first comparison cache path identically for Serve and one-shot commands.
pub(super) fn cache_line(directory: &Path, style: &Style, redactor: &Redactor) -> String {
    let line = if style.mode == Mode::Plain {
        plain_line(directory)
    } else {
        format!("  cache {}\n", directory.display())
    };
    let safe = redactor.safe(line.trim_end_matches('\n'));
    let safe = if style.mode == Mode::Rich {
        bounded(&safe, style.columns)
    } else {
        safe
    };
    if style.mode == Mode::Rich && style.color {
        format!("\x1b[2m{safe}\x1b[0m\n")
    } else {
        format!("{safe}\n")
    }
}

#[cfg(test)]
#[path = "_tests_/changes_cancellation_tests.rs"]
mod changes_cancellation_tests;

#[cfg(test)]
#[path = "_tests_/cache_reporter_tests.rs"]
mod cache_reporter_tests;
