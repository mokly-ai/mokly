//! Typed public-file policy causes and their normative diagnostic text.

use thiserror::Error;

/// Typed public-file denials keep source-protection precedence observable.
#[derive(Clone, Debug, Error, Eq, PartialEq)]
pub enum PublicDenial {
    /// Authored files cannot occupy the generated resource namespace.
    #[error("[mokly-graph/public-policy] reserved generated namespace")]
    Generated,
    /// Unsafe path or escape before tree access.
    #[error("[mokly-graph/public-policy] unsafe or escaping path")]
    Unsafe,
    /// Hidden segments cannot enter the public closure.
    #[error("[mokly-graph/public-policy] hidden path segment")]
    Hidden,
    /// Consumer installed dependencies are private.
    #[error("[mokly-graph/public-policy] consumer dependency tree")]
    Dependency,
    /// Configured package or output directory.
    #[error("[mokly-graph/public-policy] private package or output tree")]
    Private,
    /// Root glob takes precedence over other source causes.
    #[error("[mokly-graph/public-policy] matched by a source root")]
    RootMatch,
    /// Reserved source basename.
    #[error("[mokly-graph/public-policy] reserved source basename")]
    Reserved,
    /// Exact inventoried source.
    #[error("[mokly-graph/public-policy] listed authoring input")]
    Listed,
    /// CSS source or asset; the lister supplies the recovery action.
    #[error(
        "[mokly-graph/public-policy] imported by {stylesheet}; reference the delivered route under static/mokly-generated/ or keep a separate public copy"
    )]
    Imported {
        /// Importing source path.
        stylesheet: String,
    },
    /// Missing or non-file target.
    #[error("[mokly-graph/public-policy] missing, non-regular, or outside the repository")]
    Unavailable,
    /// A lexical child query proves the target is absent, rather than unreadable or nonregular.
    #[error("[mokly-graph/public-policy] missing public file")]
    Missing,
    /// A lexical path component is a symbolic link.
    #[error("[mokly-graph/public-policy] symbolic link in public path")]
    Symlink,
    /// The projected physical identity escaped confinement.
    #[error("[mokly-graph/public-policy] outside the repository")]
    Escape,
}

impl PublicDenial {
    /// Normative policy cause, without a diagnostic category prefix.
    pub fn reason(&self) -> String {
        match self {
            Self::Generated => "reserved generated namespace".into(),
            Self::Unsafe => "unsafe or escaping path".into(),
            Self::Hidden => "hidden path segment".into(),
            Self::Dependency => "consumer dependency tree".into(),
            Self::Private => "private package or output tree".into(),
            Self::RootMatch => "matched by a source root".into(),
            Self::Reserved => "reserved source basename".into(),
            Self::Listed => "listed authoring input".into(),
            Self::Imported { stylesheet } => format!(
                "imported by {stylesheet}; reference the delivered route under static/mokly-generated/ or keep a separate public copy"
            ),
            Self::Unavailable | Self::Missing => {
                "missing, non-regular, or outside the repository".into()
            }
            Self::Symlink => "symbolic link in public path".into(),
            Self::Escape => "outside the repository".into(),
        }
    }
}
