//! Request-only ownership of a fresh consumer PostCSS context.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::methods::{BundleRequest, Call, ModuleResolution};

/// A context prepared using the enclosing bundle's side and resolution settings.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize, TS)]
pub struct PostcssPreparation {
    /// Current attempt's context id.
    pub context: String,
    /// Resolved repository-relative consumer PostCSS module.
    pub postcss: String,
}

/// The preparation of a `bundle` request, sent to its sidecar before the bundle cache read and any seed.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "PrepareContextParams")]
pub struct PrepareContext {
    /// Current attempt's context id.
    pub context: String,
    /// Resolved repository-relative consumer PostCSS module.
    pub postcss: String,
    /// Side source checkout.
    pub source_root: String,
    /// Physical repositories whose local packages map into this side.
    pub repository_roots: Vec<String>,
    /// Consumer module resolution policy for this side.
    pub module_resolution: ModuleResolution,
}

impl PrepareContext {
    /// The preparation of a `bundle` request with the side and resolution settings of that request.
    pub(crate) fn for_bundle(request: &BundleRequest) -> Option<Self> {
        let preparation = request.preparation.as_ref()?;
        Some(Self {
            context: preparation.context.clone(),
            postcss: preparation.postcss.clone(),
            source_root: request.params.source_root.clone(),
            repository_roots: request.params.repository_roots.clone(),
            module_resolution: request.params.module_resolution.clone(),
        })
    }
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
            Self::PrepareContext(params) => Some(&params.context),
            Self::Hello(_)
            | Self::RestoreGeneration(_)
            | Self::Describe(_)
            | Self::ReadStorybook(_)
            | Self::Bindings(_)
            | Self::RenderScreen(_)
            | Self::RenderComponent(_)
            | Self::RenderStory(_)
            | Self::RenderPage(_)
            | Self::CssModules(_)
            | Self::TransformViteCss(_)
            | Self::Dispose(_)
            | Self::DisposeContext(_)
            | Self::Shutdown(_) => None,
        }
    }
}
