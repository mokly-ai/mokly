//! Actual worker operations for verification and opt-in diagnostics.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Operations are emitted where the worker performs them, including failed calls.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Deserialize, Serialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum Operation {
    /// One esbuild invocation.
    Esbuild,
    /// One consumer PostCSS worker starts.
    PostcssStart,
    /// One consumer PostCSS worker exits.
    PostcssStop,
}

impl Operation {
    /// Stable diagnostic name.
    pub fn label(self) -> &'static str {
        match self {
            Self::Esbuild => "esbuild",
            Self::PostcssStart => "postcss-start",
            Self::PostcssStop => "postcss-stop",
        }
    }
}
