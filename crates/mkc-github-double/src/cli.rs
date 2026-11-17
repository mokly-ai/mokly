//! Command parsing and the standalone listening runtime.

use std::io;
use std::net::SocketAddr;

use clap::{Parser, Subcommand};
use mkc_github_double::error::{ErrorResultExt, Result};
use mkc_github_double::mode::Mode;
use mkc_github_double::server::RecordedGitHub;
use tokio::signal::unix::{SignalKind, signal};

#[derive(Parser)]
#[command(
    name = "mkc-github-double",
    about = "Serve the recorded GitHub used by development and tests"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Answer recorded GitHub requests until the process is terminated.
    Serve {
        /// Address to listen on; port 0 chooses a free port.
        #[arg(long, default_value = "127.0.0.1:0")]
        bind: SocketAddr,
        /// Origin the token exchange must present as its redirect target.
        #[arg(long, default_value = "https://app.example.com")]
        app_origin: String,
        /// App ID the check-run list must filter by.
        #[arg(long, default_value_t = 123)]
        app_id: u64,
        /// Client ID the token exchange must present.
        #[arg(long, default_value = "Iv1.fixture")]
        client_id: String,
        /// Client secret the token exchange must present.
        #[arg(long, default_value = "fixture-client-secret")]
        client_secret: String,
        /// Include the recorded installation on the fixture-org account.
        #[arg(long)]
        second_installation: bool,
    },
}

impl Command {
    fn into_server_settings(self) -> (SocketAddr, Mode) {
        match self {
            Self::Serve {
                bind,
                app_origin,
                app_id,
                client_id,
                client_secret,
                second_installation,
            } => (
                bind,
                Mode {
                    app_origin,
                    app_id,
                    client_id,
                    client_secret,
                    second_installation,
                    ..Mode::default()
                },
            ),
        }
    }
}

pub(crate) trait CommandRunner {
    fn run(&self) -> Result<()>;
}

pub(crate) struct SystemCommandRunner;

impl CommandRunner for SystemCommandRunner {
    fn run(&self) -> Result<()> {
        tracing_subscriber::fmt()
            .with_env_filter("info")
            .with_writer(io::stderr)
            .init();
        let (bind, mode) = Cli::parse().command.into_server_settings();
        let github = RecordedGitHub::start_with(bind, mode)?;
        println!("{}", github.origin);
        terminated()
    }
}

/// Block until the supervisor asks the double to stop.
fn terminated() -> Result<()> {
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .context("initialize the signal runtime")?;
    let waited: io::Result<()> = runtime.block_on(async {
        let mut terminate = signal(SignalKind::terminate())?;
        tokio::select! {
            _ = terminate.recv() => (),
            result = tokio::signal::ctrl_c() => result?,
        }
        Ok(())
    });
    waited.context("wait for termination")?;
    Ok(())
}

#[cfg(test)]
#[path = "_tests_/cli_tests.rs"]
mod cli_tests;
