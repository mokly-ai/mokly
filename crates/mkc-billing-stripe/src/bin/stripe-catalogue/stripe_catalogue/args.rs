//! Command-line arguments for Stripe catalogue validation and reconciliation.

use clap::{Args, Subcommand, ValueEnum};

/// Arguments below `stripe-catalogue`.
#[derive(Args)]
pub(crate) struct StripeCatalogueArgs {
    /// Catalogue operation to run.
    #[command(subcommand)]
    pub(crate) command: StripeCatalogueCommand,
}

/// Stripe catalogue operations.
#[derive(Subcommand)]
pub(crate) enum StripeCatalogueCommand {
    /// Validate and print the intended catalogue without network access.
    Check,
    /// Compare Stripe with the catalogue and optionally reconcile it.
    Sync(OperationArgs),
    /// Find superseded prices and optionally archive eligible ones.
    Archive(OperationArgs),
}

/// Arguments shared by catalogue reconciliation and archival.
#[derive(Args)]
pub(crate) struct OperationArgs {
    /// Stable environment whose Stripe account mode may be changed.
    #[arg(long, value_enum)]
    pub(crate) environment: CatalogueEnvironment,
    /// Apply writes; without this flag the command is read-only.
    #[arg(long)]
    pub(crate) apply: bool,
}

/// Stable deployment environment and required Stripe account mode.
#[derive(Clone, Copy, Debug, PartialEq, Eq, ValueEnum)]
pub(crate) enum CatalogueEnvironment {
    /// Test-mode account used by the stable preview environment.
    MainPreview,
    /// Live-mode account used by production.
    Production,
}

impl CatalogueEnvironment {
    /// Stable command-line spelling.
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::MainPreview => "main-preview",
            Self::Production => "production",
        }
    }

    /// Required Stripe key mode.
    pub(crate) fn key_mode(self) -> &'static str {
        match self {
            Self::MainPreview => "test",
            Self::Production => "live",
        }
    }
}
