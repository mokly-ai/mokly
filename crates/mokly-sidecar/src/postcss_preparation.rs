//! Request-only ownership of a fresh consumer PostCSS context.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::methods::Call;

/// A context prepared using the enclosing bundle's side and resolution settings.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize, TS)]
pub struct PostcssPreparation {
    /// Current attempt's context id.
    pub context: String,
    /// Resolved repository-relative consumer PostCSS module.
    pub postcss: String,
}

impl Call {
    /// Context owned by this call, including preparation before the first stylesheet.
    pub fn postcss_context(&self) -> Option<&str> {
        match self {
            Self::Bundle(request) => request
                .preparation
                .as_ref()
                .map(|value| value.context.as_str()),
            Self::ProcessCss(params) => Some(&params.context),
            _ => None,
        }
    }
}
