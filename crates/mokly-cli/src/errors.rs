//! Typed expected CLI failures.

use clap::Error;
use thiserror::Error;

/// Invalid input or a command whose subsystem is absent.
#[derive(Debug, Error)]
pub enum Failure {
    /// Unknown public verb.
    #[error("[mokly/cli-invalid] unknown command: {candidate}")]
    UnknownCommand {
        /// Typed command candidate.
        candidate: String,
    },
    /// Unknown option for this command.
    #[error("[mokly/cli-invalid] unknown option: {option}")]
    UnknownOption {
        /// Typed option.
        option: String,
    },
    /// A short flag has trailing text or an assignment.
    #[error("[mokly/cli-invalid] short flag cannot have trailing text: {option}")]
    ShortFlag {
        /// Rejected flag spelling.
        option: String,
    },
    /// A boolean option has an assigned value.
    #[error("[mokly/cli-invalid] boolean option does not take a value: {option}")]
    BooleanAssignment {
        /// Rejected option.
        option: String,
    },
    /// An option was repeated.
    #[error("[mokly/cli-invalid] option cannot be repeated: {option}")]
    RepeatedOption {
        /// Repeated option name.
        option: String,
    },
    /// A separate option value begins with a hyphen.
    #[error(
        "[mokly/cli-invalid] {option} needs a value; use its assigned form for a value starting with -"
    )]
    SeparateHyphen {
        /// Option whose value is missing.
        option: String,
    },
    /// Strict mode is unavailable for Serve.
    #[error("[mokly/cli-invalid] --strict belongs to build or publish")]
    StrictOutsideBuild,
    /// Invalid environment sidecar override.
    #[error("[mokly/cli-invalid] MOKLY_SIDECARS must be a positive integer")]
    SidecarEnvironment,
    /// No publication endpoint was supplied.
    #[error("[mokly/cli-invalid] publish requires --endpoint or MOKLY_ENDPOINT")]
    EndpointRequired,
    /// Invalid publication endpoint.
    #[error(
        "[mokly/cli-invalid] publish endpoint must be an HTTP(S) URL without credentials or a fragment"
    )]
    EndpointInvalid,
    /// No publication credential was supplied.
    #[error("[mokly/cli-invalid] publish requires --token or MOKLY_TOKEN")]
    TokenRequired,
    /// Invalid bearer credential.
    #[error("[mokly/cli-invalid] publish token must use the bearer-token grammar")]
    TokenInvalid,
    /// Another clap grammar or value error.
    #[error("[mokly/cli-invalid] {}", syntax_detail(.source))]
    Syntax {
        /// Original typed parser error.
        source: Error,
    },
    /// A command subsystem is absent from this build.
    #[error("[mokly/build-invalid] The {command} command is not available in this build.")]
    Unavailable {
        /// Public command name.
        command: &'static str,
    },
}

impl Failure {
    /// Human detail without the stable protocol prefix.
    pub fn detail(&self) -> String {
        match self {
            Self::UnknownCommand { candidate } => format!("unknown command: {candidate}"),
            Self::UnknownOption { option } => format!("unknown option: {option}"),
            Self::ShortFlag { option } => format!("short flag cannot have trailing text: {option}"),
            Self::BooleanAssignment { option } => {
                format!("boolean option does not take a value: {option}")
            }
            Self::RepeatedOption { option } => format!("option cannot be repeated: {option}"),
            Self::SeparateHyphen { option } => {
                format!("{option} needs a value; use its assigned form for a value starting with -")
            }
            Self::StrictOutsideBuild => "--strict belongs to build or publish".into(),
            Self::SidecarEnvironment => "MOKLY_SIDECARS must be a positive integer".into(),
            Self::EndpointRequired => "publish requires --endpoint or MOKLY_ENDPOINT".into(),
            Self::EndpointInvalid => {
                "publish endpoint must be an HTTP(S) URL without credentials or a fragment".into()
            }
            Self::TokenRequired => "publish requires --token or MOKLY_TOKEN".into(),
            Self::TokenInvalid => "publish token must use the bearer-token grammar".into(),
            Self::Syntax { source } => syntax_detail(source),
            Self::Unavailable { command } => {
                format!("The {command} command is not available in this build.")
            }
        }
    }
}

fn syntax_detail(source: &Error) -> String {
    source
        .to_string()
        .lines()
        .next()
        .unwrap_or("invalid command")
        .trim_start_matches("error: ")
        .to_owned()
}
