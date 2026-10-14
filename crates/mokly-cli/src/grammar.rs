//! Complete end-state command grammar.

use clap::{Args, Parser, Subcommand};

/// Parsed public CLI; absent subcommand selects watched Serve.
#[derive(Debug, Parser)]
#[command(
    name = "mokly",
    version,
    about = "Build and browse static mockup catalogues",
    after_help = "Configuration: search upward for mokly.config.json, or pass --config PATH.",
    disable_help_subcommand = true, color = clap::ColorChoice::Never
)]
pub struct Cli {
    /// Options shared by every command.
    #[command(flatten)]
    pub common: Common,
    /// Default Serve options when no subcommand is supplied.
    #[command(flatten)]
    pub serve: Serve,
    /// Selected command; omission runs Serve.
    #[command(subcommand)]
    pub command: Option<Verb>,
}

/// Shared command options.
#[derive(Clone, Debug, Default, Args)]
pub struct Common {
    /// Configuration JSON path; otherwise search upward.
    #[arg(long, global = true, value_parser = nonempty)]
    pub config: Option<String>,
    /// Comparison base ref; overrides review.base (default origin/main).
    #[arg(long, global = true, value_parser = nonempty, allow_hyphen_values = false)]
    pub base: Option<String>,
    /// Sidecar count; defaults to MOKLY_SIDECARS or the core count.
    #[arg(long, global = true, value_parser = positive)]
    pub sidecars: Option<usize>,
    /// Write timing JSON to stderr and select plain output.
    #[arg(long, global = true)]
    pub debug_timings: bool,
}

/// Serve-only options; watch is enabled unless --no-watch is supplied.
#[derive(Clone, Debug, Default, Args)]
pub struct Serve {
    /// Starting port, 0 through 65535 (default 4173).
    #[arg(long)]
    pub port: Option<u16>,
    /// Watch source files (the default).
    #[arg(long, conflicts_with = "no_watch")]
    pub watch: bool,
    /// Serve one snapshot without watching files.
    #[arg(long)]
    pub no_watch: bool,
    /// Open the catalogue after its URL is ready.
    #[arg(long)]
    pub open: bool,
}

/// Static-build options.
#[derive(Clone, Debug, Args)]
pub struct Build {
    /// Static output directory (default mokly-static/).
    #[arg(long, value_parser = nonempty)]
    pub out: Option<String>,
    /// Fail on warnings before writing output.
    #[arg(long)]
    pub strict: bool,
    /// Skip comparisons and base lookup.
    #[arg(long, conflicts_with = "base")]
    pub no_changes: bool,
}

/// Publication options; publication always fails on build warnings.
#[derive(Clone, Debug, Args)]
pub struct Publish {
    /// Plan endpoint; overrides MOKLY_ENDPOINT.
    #[arg(long, value_parser = nonempty)]
    pub endpoint: Option<String>,
    /// Bearer credential; overrides MOKLY_TOKEN.
    #[arg(long, value_parser = nonempty)]
    pub token: Option<String>,
    /// Repository identity as host/owner/name.
    #[arg(long, value_parser = nonempty)]
    pub repository: Option<String>,
    /// Maximum parallel Blob requests, 1 through 32.
    #[arg(long, default_value = "8", value_parser = clap::value_parser!(u8).range(1..=32))]
    pub upload_concurrency: u8,
    /// Fail on every build warning before uploading.
    #[arg(long)]
    pub strict: bool,
    /// Skip comparisons and base lookup.
    #[arg(long, conflicts_with = "base")]
    pub no_changes: bool,
}

/// Public commands.
#[derive(Debug, Subcommand)]
pub enum Verb {
    /// Serve the catalogue and comparisons; watch by default.
    Serve(Serve),
    /// Validate and render every view into a static site.
    Build(Build),
    /// Build into a private directory and upload.
    Publish(Publish),
}

impl Verb {
    /// Stable command name used in unavailable-command diagnostics.
    pub fn name(&self) -> &'static str {
        match self {
            Self::Serve(_) => "serve",
            Self::Build(_) => "build",
            Self::Publish(_) => "publish",
        }
    }
}

fn nonempty(value: &str) -> std::result::Result<String, String> {
    if value.is_empty() {
        Err("value must not be empty".into())
    } else {
        Ok(value.into())
    }
}

fn positive(value: &str) -> std::result::Result<usize, String> {
    match value.parse::<usize>() {
        Ok(value) if value > 0 => Ok(value),
        _ => Err("sidecar count must be a positive integer".into()),
    }
}

#[cfg(test)]
#[path = "_tests_/grammar_tests.rs"]
mod grammar_tests;
