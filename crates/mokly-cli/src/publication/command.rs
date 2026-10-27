//! Publish orchestration: clean checkout, build, recheck, then exchange.

use std::path::PathBuf;
use std::sync::Arc;

use async_trait::async_trait;
use mokly_publish::accounting::Receipt;
use mokly_publish::checkout::Checkout;
use mokly_publish::error;
use mokly_publish::exchange::Exchange;
use mokly_publish::identity::ActionsContext;
use mokly_publish::runtime::Cancellation;
use mokly_publish::settings::Settings;

use crate::publication::build::{BuildRequest, Directories, StaticOutput};
use crate::publication::error::{Error, ExchangeResult, Result};
use crate::publication::mapping::checkout_result;

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
    /// Fail on build warnings before output installation or upload.
    pub strict: bool,
    /// Pinned operation-owned paths excluded from status, never names guessed from Git output.
    pub owned_paths: Vec<PathBuf>,
}

/// Durable command output before the static build starts.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = BuildReporterMock))]
pub trait BuildReporter: Send + Sync {
    /// Report the private build directory exactly once, before calling the builder.
    fn build_directory(&self, directory: &std::path::Path);
    /// Warn with the allocated private root when cleanup fails after publication.
    fn retained_directory(&self, directory: &std::path::Path);
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
        let initial = checkout_result(
            self.checkout
                .inspect(&options.directory, &options.owned_paths, cancellation),
            cancellation,
        )?;
        if !initial.changed_paths.is_empty() {
            return Err(Error::Uncommitted {
                paths: initial.changed_paths,
                during_build: false,
                build_directories: initial.build_directories,
            });
        }
        let publication = checkout_result(
            self.checkout.publication(
                &initial,
                &options.version,
                options.repository.as_deref(),
                &options.actions,
                cancellation,
            ),
            cancellation,
        )?;
        let private_directory = self.directories.create(&initial.root)?;
        let directory = private_directory.join("site");
        self.reporter.build_directory(&directory);
        let request = BuildRequest {
            invocation_directory: options.directory.clone(),
            repository_root: initial.root.clone(),
            directory: directory.clone(),
            config: options.config.clone(),
            base: options.base.clone(),
            no_changes: options.no_changes,
            strict: options.strict,
            publication,
        };
        let snapshot = self.output.build(&request, cancellation)?;
        let finalized = snapshot.capture().publication()?;
        let artifact = finalized.artifact();
        if artifact.directory != directory {
            return Err(Error::Exchange {
                source: error::Error::InvalidBundle,
            });
        }
        let prepared = finalized.prepared();
        let final_state = self
            .checkout
            .inspect(&initial.root, &options.owned_paths, cancellation)
            .publication()?;
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
            || (options.no_changes && prepared.metadata.base_sha.is_some())
        {
            return Err(Error::Exchange {
                source: error::Error::InvalidBundle,
            });
        }
        let receipt = self
            .exchange
            .publish(prepared, settings, cancellation)
            .await
            .publication()?;
        if self.directories.remove(&private_directory).is_err() {
            self.reporter.retained_directory(&private_directory);
        }
        Ok(receipt)
    }
}

#[cfg(test)]
#[path = "_tests_/mod.rs"]
mod tests;
