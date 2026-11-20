//! CLI parsing and native runtime construction.

use std::io::{self, Write};
use std::sync::Arc;

use clap::{Parser, Subcommand};
use mkc_api::application::{ApplicationFactory, SystemApplicationFactory};
use mkc_api::contract::document::ApiDoc;
use mkc_api::error::{ApiErrorResultExt, Result};
use mkc_api::preview_seed::factory::PreviewSeedFactory;
use mkc_config::settings::{ConfigProvider, Environment, EnvironmentConfig, ProcessEnvironment};
use utoipa::OpenApi;
use uuid::Uuid;

use crate::cli_maintenance::{MaintenanceRunner, SystemMaintenanceRunner};
use crate::cli_recovery::{CheckCommand, RecoveryRunner, SystemRecoveryRunner};

#[derive(Parser)]
#[command(name = "mkc-api", about = "Mokly Cloud platform API")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Print the Rust-owned OpenAPI document as pretty JSON.
    Openapi,
    /// Seed one preview run through the API's services and write its evidence.
    PreviewSeed {
        /// Seed folder run key, supplied by the release job or local stack.
        #[arg(long)]
        run: String,
    },
    /// Emit the current failed billing delivery count for alerting.
    BillingDeliveryStatus,
    /// Emit the current undelivered publication dead-letter count for alerting.
    PublicationCheckStatus,
    /// Remove retained expired authentication records using database credentials only.
    Prune,
    /// Remove expired GitHub OAuth flows and terminal webhook deliveries.
    PruneGithub,
    /// Apply pending migrations and serve the platform API.
    Serve,
    /// Recover failed uploads and collect unreferenced objects.
    MaintainPublications,
    /// Apply pending database migrations and exit.
    Migrate,
    /// Make one undelivered dead-lettered publication check due for delivery.
    RequeuePublicationCheck {
        /// Durable publication event ID from worker diagnostics or the database.
        #[arg(long)]
        event: Uuid,
    },
    /// Make one undelivered dead-lettered build check due for delivery.
    RequeueBuildCheck {
        /// Durable build ID from worker diagnostics or the database.
        #[arg(long)]
        build: Uuid,
    },
    /// Make one failed Stripe delivery due for processing again.
    RequeueBillingDelivery {
        /// Stripe event ID from billing worker diagnostics or the database.
        #[arg(long)]
        event: String,
    },
}

pub(crate) trait CommandRunner {
    fn run(&self) -> Result<()>;
}

pub(crate) struct SystemCommandRunner;

impl CommandRunner for SystemCommandRunner {
    fn run(&self) -> Result<()> {
        let cli = Cli::parse();
        if matches!(cli.command, Command::Openapi) {
            let document = ApiDoc::openapi()
                .to_pretty_json()
                .context("serialize OpenAPI document")?;
            return writeln!(io::stdout().lock(), "{document}").context("write OpenAPI document");
        }
        tracing_subscriber::fmt()
            .json()
            .with_env_filter("info")
            .init();
        let environment: Arc<dyn Environment> = Arc::new(ProcessEnvironment);
        let provider: &dyn ConfigProvider = &EnvironmentConfig {
            environment: environment.clone(),
        };
        let maintenance: &dyn MaintenanceRunner = &SystemMaintenanceRunner {
            config: EnvironmentConfig {
                environment: environment.clone(),
            },
        };
        let recovery: &dyn RecoveryRunner = &SystemRecoveryRunner { environment };
        match cli.command {
            Command::Openapi => Ok(()),
            Command::PreviewSeed { run } => {
                tracing::info!(step = "configuration", "preview seed step");
                let settings = provider
                    .load()
                    .inspect_err(|error| {
                        tracing::error!(
                            step = "configuration",
                            ?error,
                            "preview seed configuration failed"
                        );
                    })
                    .context("load API configuration")?;
                let factory: &dyn PreviewSeedFactory = &SystemApplicationFactory;
                let seed = factory
                    .create_seed(settings)
                    .inspect_err(|error| {
                        tracing::error!(
                            step = "configuration",
                            ?error,
                            "preview seed configuration failed"
                        );
                    })
                    .context("configure preview seed")?;
                seed.run(&run).context("run preview seed")
            }
            Command::Prune => maintenance.prune(),
            Command::PruneGithub => maintenance.prune_github(),
            Command::Migrate => maintenance.migrate(),
            Command::MaintainPublications => maintenance.maintain_publications(),
            Command::Serve => {
                let settings = provider.load().context("load API configuration")?;
                let factory: &dyn ApplicationFactory = &SystemApplicationFactory;
                let app = factory.create(settings)?;
                let runtime = tokio::runtime::Builder::new_multi_thread()
                    .enable_all()
                    .build()
                    .context("create API runtime")?;
                runtime.block_on(app.serve())
            }
            Command::RequeuePublicationCheck { event } => {
                recovery.checks(CheckCommand::RequeuePublication(event))
            }
            Command::RequeueBuildCheck { build } => {
                recovery.checks(CheckCommand::RequeueBuild(build))
            }
            Command::PublicationCheckStatus => recovery.checks(CheckCommand::Status),
            Command::RequeueBillingDelivery { event } => recovery.billing(Some(&event)),
            Command::BillingDeliveryStatus => recovery.billing(None),
        }
    }
}

#[cfg(test)]
#[path = "_tests_/cli_tests.rs"]
mod tests;
