//! Standalone catalogue command parsing and native runtime initialization.

use std::sync::Arc;

use clap::{Parser, Subcommand};
use mkc_catalogue_server::application::{ApplicationFactory, SystemApplicationFactory};
use mkc_catalogue_server::error::{ErrorResultExt, Result};
use mkc_config::catalogue::CatalogueConfig;
use mkc_config::settings::{EnvironmentConfig, ProcessEnvironment};

#[derive(Parser)]
#[command(
    name = "mkc-catalogue-server",
    about = "Serve isolated Mokly publications"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Apply pending migrations and serve immutable catalogues.
    Serve,
}

pub(crate) trait CommandRunner {
    fn run(&self) -> Result<()>;
}

pub(crate) struct SystemCommandRunner;

impl CommandRunner for SystemCommandRunner {
    fn run(&self) -> Result<()> {
        tracing_subscriber::fmt()
            .json()
            .with_env_filter("info")
            .init();
        let cli = Cli::parse();
        match cli.command {
            Command::Serve => {
                let settings = EnvironmentConfig {
                    environment: Arc::new(ProcessEnvironment),
                }
                .catalogue()
                .context("load catalogue settings")?;
                let application = SystemApplicationFactory.create(settings)?;
                let runtime = tokio::runtime::Builder::new_multi_thread()
                    .enable_all()
                    .build()
                    .context("initialize catalogue runtime")?;
                runtime.block_on(application.serve())
            }
        }
    }
}
