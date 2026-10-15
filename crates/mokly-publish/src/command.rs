//! Publish orchestration: clean checkout, build, recheck, then exchange.

use std::path::PathBuf;
use std::sync::Arc;

use async_trait::async_trait;

use crate::accounting::Receipt;
use crate::build::{BuildRequest, Directories, StaticOutput, warnings_are_fatal};
use crate::checkout::Checkout;
use crate::error::{Error, Result};
use crate::exchange::Exchange;
use crate::identity::ActionsContext;
use crate::runtime::Cancellation;
use crate::settings::Settings;

/// Normalized command inputs. Secrets remain in Settings, outside this value.
#[derive(Clone, Debug)]
pub struct Options {
    /// Invocation directory for normal Git and configuration discovery.
    pub directory: PathBuf,
    /// Installed package version.
    pub version: String,
    /// Optional explicit repository assertion.
    pub repository: Option<String>,
    /// Environment revision context, read only in GitHub Actions.
    pub actions: ActionsContext,
    /// Explicit configuration path.
    pub config: Option<PathBuf>,
    /// Explicit comparison base.
    pub base: Option<String>,
    /// Skip all comparison work and history lookup.
    pub no_changes: bool,
    /// Keep the grammar while the warning policy decision remains open.
    pub strict: bool,
    /// Pinned operation-owned paths excluded from status, never names guessed from Git output.
    pub owned_paths: Vec<PathBuf>,
}

/// Durable command output before the static build starts.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = BuildReporterMock))]
pub trait BuildReporter: Send + Sync {
    /// Report the private build directory exactly once, before calling the builder.
    fn build_directory(&self, directory: &std::path::Path);
}

/// End-to-end publication command boundary.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = PublishMock))]
#[async_trait]
pub trait Publish: Send + Sync {
    /// Run one command. Upload failure never removes the completed build.
    async fn run(
        &self,
        options: &Options,
        settings: &Settings,
        cancellation: &dyn Cancellation,
    ) -> Result<Receipt>;
}

/// Composition of the independent Git, static output, reporting and exchange seams.
pub struct Command {
    /// Clean checkout and repository identity adapter.
    pub checkout: Arc<dyn Checkout>,
    /// Private output directory allocator.
    pub directories: Arc<dyn Directories>,
    /// Static output transaction, supplied by the composition root.
    pub output: Arc<dyn StaticOutput>,
    /// Durable pre-build directory line.
    pub reporter: Arc<dyn BuildReporter>,
    /// Exchange v1 coordinator.
    pub exchange: Arc<dyn Exchange>,
}

#[async_trait]
impl Publish for Command {
    async fn run(
        &self,
        options: &Options,
        settings: &Settings,
        cancellation: &dyn Cancellation,
    ) -> Result<Receipt> {
        let initial =
            self.checkout
                .inspect(&options.directory, &options.owned_paths, cancellation)?;
        if !initial.changed_paths.is_empty() {
            return Err(Error::Uncommitted {
                paths: initial.changed_paths,
                during_build: false,
                build_directories: initial.build_directories,
            });
        }
        let publication = self.checkout.publication(
            &initial,
            &options.version,
            options.repository.as_deref(),
            &options.actions,
            cancellation,
        )?;
        let directory = self.directories.create(&initial.root)?;
        self.reporter.build_directory(&directory);
        let request = BuildRequest {
            repository_root: initial.root.clone(),
            directory: directory.clone(),
            config: options.config.clone(),
            base: options.base.clone(),
            no_changes: options.no_changes,
            warnings_are_fatal: warnings_are_fatal(options.strict),
            publication,
        };
        let snapshot = self.output.build(&request, cancellation)?;
        let artifact = snapshot.capture()?;
        if artifact.directory != directory {
            return Err(Error::InvalidBundle);
        }
        let prepared = artifact.prepare()?;
        let final_state =
            self.checkout
                .inspect(&initial.root, &options.owned_paths, cancellation)?;
        if final_state.root != initial.root || final_state.head_sha != initial.head_sha {
            return Err(Error::HeadChanged);
        }
        if !final_state.changed_paths.is_empty() {
            return Err(Error::Uncommitted {
                paths: final_state.changed_paths,
                during_build: true,
                build_directories: final_state.build_directories,
            });
        }
        if prepared.metadata.head_sha != initial.head_sha
            || prepared.metadata.repository != request.publication.repository
            || prepared.metadata.branch != request.publication.branch
            || prepared.metadata.mokly_version != options.version
            || prepared.metadata.pull_request != request.publication.pull_request
            || (options.no_changes && prepared.metadata.comparison_path.is_some())
        {
            return Err(Error::InvalidBundle);
        }
        self.exchange
            .publish(&prepared, settings, cancellation)
            .await
    }
}
