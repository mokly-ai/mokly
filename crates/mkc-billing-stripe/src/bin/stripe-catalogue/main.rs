//! AGPL Stripe catalogue validation and reconciliation command.

#![warn(unreachable_pub)]
#![cfg_attr(test, allow(clippy::unwrap_used, clippy::expect_used, clippy::panic))]

mod composition;
mod stripe_catalogue;

use std::process::ExitCode;

use clap::Parser;

use stripe_catalogue::args::StripeCatalogueArgs;

/// Validate, synchronize, or archive the repository-owned Stripe catalogue.
#[derive(Parser)]
#[command(name = "stripe-catalogue")]
struct Cli {
    #[command(flatten)]
    args: StripeCatalogueArgs,
}

fn main() -> ExitCode {
    match composition::run(Cli::parse().args) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("{error}");
            ExitCode::FAILURE
        }
    }
}
