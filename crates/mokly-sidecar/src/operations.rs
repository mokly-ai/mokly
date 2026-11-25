//! Actual worker operations for verification and opt-in diagnostics.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Operations are emitted where the worker performs them, including failed calls.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Deserialize, Serialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum Operation {
    /// One esbuild invocation.
    Esbuild,
    /// One project Vite compilation.
    Vite,
    /// One consumer PostCSS worker starts.
    PostcssStart,
    /// One consumer PostCSS worker exits.
    PostcssStop,
}

impl Operation {
    /// Whether this event marks a catalogue compilation.
    pub(crate) fn is_compile(self) -> bool {
        match self {
            Self::Esbuild | Self::Vite => true,
            Self::PostcssStart | Self::PostcssStop => false,
        }
    }

    /// Stable diagnostic name.
    pub fn label(self) -> &'static str {
        match self {
            Self::Esbuild => "esbuild",
            Self::Vite => "vite",
            Self::PostcssStart => "postcss-start",
            Self::PostcssStop => "postcss-stop",
        }
    }
}
