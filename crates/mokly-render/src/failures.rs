//! Map expected adapter failures into typed cross-crate diagnostic data.

use mokly_css::error::CssError;
use mokly_model::runtime_diagnostic::{RuntimeCode, RuntimeDiagnostic};

use crate::error::RenderError;

impl RenderError {
    pub(crate) fn diagnostic(&self) -> Option<RuntimeDiagnostic> {
        let message = match self {
            Self::Sidecar { source } => return source.diagnostic(),
            Self::Css {
                source: CssError::Runtime { source },
            } => return Some(source.clone()),
            Self::Css {
                source: CssError::Transform { message, .. } | CssError::Asset { message, .. },
            } => message.clone(),
            Self::ResultKind { method } => {
                return Some(RuntimeDiagnostic {
                    code: RuntimeCode::Protocol,
                    message: format!("unexpected result for {method}"),
                });
            }
            Self::Input { key } => format!("conflicting fragment input {key}"),
            Self::NestedImport {
                plugin,
                stylesheet,
                excluded,
                intermediate,
            } => format!(
                "PostCSS plugin {plugin} reached renderer-owned CSS in {stylesheet}: {excluded} via {intermediate}; import it only from the renderer, import it directly so Mokly can prune it, or use Tailwind @reference"
            ),
            Self::Dependency {
                stylesheet,
                plugin,
                path,
                reason,
            } => reason.message(plugin, stylesheet, path),
            Self::StylesheetPath { component, path } => {
                format!("component {component} declares invalid stylesheet {path}")
            }
            Self::StylesheetPolicy {
                component,
                path,
                source,
            } => format!(
                "component {component} stylesheet {path}: {}",
                source.reason()
            ),
            _ => return None,
        };
        Some(RuntimeDiagnostic {
            code: RuntimeCode::Build,
            message,
        })
    }
}
