//! Comparison uses the command's shared sidecar pool, cache, and cancellation graph.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_cli::cancellation::Cancellation;
use mokly_cli::output::{Mode, Style, bounded};
use mokly_cli::redaction::Redactor;
use mokly_cli::static_build::{Phase, Phases};
use mokly_compare::base_render::{Changes, ChangesService, GitSourceFactory};
use mokly_compare::cache_types::Reporter;
use mokly_compare::comparison::Engine;
use mokly_compare::comparison_types::ComparisonResult;
use mokly_compare::error::Result;
use mokly_compare::locations::{OnceReporter, plain_line};
use mokly_compare::moves::Detector;
use mokly_css::parsed_cache::MemoryParsedCss;
use mokly_git::control::{self, SystemClock, Token};
use mokly_git::disk::SystemDisk;
use mokly_git::repository::GitRepositories;
use mokly_git::system::SystemRunner;
use mokly_git::tree::Limits;
use mokly_graph::types::RenderGeneration;
use mokly_platform::processes::SystemProcessGroups;
use mokly_render::runtime::Runtime;

use crate::base_dependencies::NativeDependencies;
use crate::changes_base::NativeBase;
use crate::terminal::Terminal;

pub(super) fn service(
    runtime: Arc<Runtime>,
    cancellation: Arc<dyn Cancellation>,
    terminal: Arc<dyn Terminal>,
    style: Style,
    redactor: Arc<Redactor>,
    phases: Arc<dyn Phases>,
) -> Arc<dyn ChangesService> {
    let token: Arc<dyn control::Cancellation> = Arc::new(GitCancellation {
        command: cancellation.clone(),
        token: Token::default(),
    });
    let reporter: Arc<dyn Reporter> = Arc::new(OnceReporter {
        announced: false.into(),
        reporter: Arc::new(CacheReporter {
            terminal,
            style,
            redactor,
        }),
    });
    let changes = Arc::new(Changes {
        repositories: Arc::new(GitRepositories {
            runner: Arc::new(SystemRunner {
                clock: Arc::new(SystemClock::default()),
                cancellation: token.clone(),
                groups: Arc::new(SystemProcessGroups),
            }),
            disk: Arc::new(SystemDisk),
        }),
        sources: Arc::new(GitSourceFactory {
            limits: Limits::default(),
            batch_bytes: 48 * 1024 * 1024,
        }),
        provider: Arc::new(NativeBase {
            runtime,
            cancellation,
            dependencies: Arc::new(NativeDependencies {
                cancellation: token,
                reporter,
            }),
        }),
        comparison: Arc::new(Engine {
            moves: Arc::new(Detector),
            css: Arc::new(MemoryParsedCss::new(64 * 1024 * 1024)),
        }),
    });
    Arc::new(PhasedChanges { changes, phases })
}

struct PhasedChanges {
    changes: Arc<dyn ChangesService>,
    phases: Arc<dyn Phases>,
}
impl ChangesService for PhasedChanges {
    fn classify(
        &self,
        config: &ResolvedConfig,
        base: Option<&str>,
        head: Arc<dyn RenderGeneration>,
    ) -> Result<ComparisonResult> {
        self.phases.start(Phase::Comparing);
        self.changes.classify(config, base, head)
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
    terminal: Arc<dyn Terminal>,
    style: Style,
    redactor: Arc<Redactor>,
}
impl Reporter for CacheReporter {
    fn opened(&self, directory: &Path) {
        let line = if self.style.mode == Mode::Plain {
            plain_line(directory)
        } else {
            format!("  cache {}\n", directory.display())
        };
        let safe = self.redactor.safe(line.trim_end_matches('\n'));
        let safe = if self.style.mode == Mode::Rich {
            bounded(&safe, self.style.columns)
        } else {
            safe
        };
        let line = if self.style.mode == Mode::Rich && self.style.color {
            format!("\x1b[2m{safe}\x1b[0m\n")
        } else {
            format!("{safe}\n")
        };
        self.terminal.stdout(&line);
    }
}

#[cfg(test)]
#[path = "_tests_/changes_cancellation_tests.rs"]
mod changes_cancellation_tests;

#[cfg(test)]
#[path = "_tests_/cache_reporter_tests.rs"]
mod cache_reporter_tests;
