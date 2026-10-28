//! Typed consumer PostCSS failures and their catalogued presentation.

use mokly_model::runtime_diagnostic::{RuntimeCode, RuntimeDiagnostic};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use ts_rs::TS;

/// Expected PostCSS failure; all source fields are logical repository paths.
#[derive(Clone, Debug, Deserialize, Serialize, TS, Error)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
#[error("[mokly-sidecar/postcss] consumer processor failed")]
pub enum PostcssFailure {
    /// Module evaluation or default export failed.
    Load {
        /// Repository-relative module path without `.` or `..` segments.
        module: String,
        /// Tool detail.
        detail: String,
    },
    /// Unsupported configuration property.
    Key {
        /// Authored property name.
        key: String,
    },
    /// Missing or malformed plugin list.
    Plugins,
    /// Invalid member of a plugin array.
    ArrayPlugin {
        /// Zero-based member index.
        index: u32,
        /// Tool detail.
        detail: String,
    },
    /// Invalid named-plugin options.
    Options {
        /// Authored plugin name.
        plugin: String,
    },
    /// Named plugin resolution or factory failed.
    Factory {
        /// Authored plugin name.
        plugin: String,
        /// Repository-relative module path without `.` or `..` segments.
        module: String,
        /// Tool detail.
        detail: String,
    },
    /// A plugin failed while processing a stylesheet.
    Plugin {
        /// Reporting plugin or unknown.
        plugin: String,
        /// Repository-relative stylesheet.
        stylesheet: String,
        /// Tool detail.
        detail: String,
    },
    /// A plugin emitted an invalid dependency record.
    Dependency {
        /// Reporting plugin or unknown.
        plugin: String,
        /// Repository-relative stylesheet.
        stylesheet: String,
    },
}

impl PostcssFailure {
    /// Exact code and text from the imported stylesheet diagnostics catalogue.
    pub fn diagnostic(&self) -> RuntimeDiagnostic {
        let code = if matches!(self, Self::Plugin { .. } | Self::Dependency { .. }) {
            RuntimeCode::Build
        } else {
            RuntimeCode::Configuration
        };
        let message = match self {
            Self::Load { module, detail } => format!("could not load postcss module {module}: {detail}; default-export an object with plugins"),
            Self::Key { key } => format!("postcss configuration has unsupported key: {key}; only plugins and map are supported"),
            Self::Plugins => "postcss plugins must be an array of plugin instances or an object mapping package names to option objects".into(),
            Self::ArrayPlugin { index, detail } => format!("postcss plugins[{index}] is not a PostCSS 8 plugin: {detail}; use a plugin instance, creator, function or object with a postcss factory"),
            Self::Options { plugin } => format!("postcss plugins[{plugin}] must be a plain option object"),
            Self::Factory { plugin, module, detail } => format!("could not load PostCSS plugin {plugin} from {module}: {detail}; install and configure it in the consumer repository"),
            Self::Plugin { plugin, stylesheet, detail } => format!("PostCSS plugin {plugin} failed for {stylesheet}: {detail}; fix the plugin configuration or stylesheet"),
            Self::Dependency { plugin, stylesheet } => format!("PostCSS plugin {plugin} reported an invalid dependency for {stylesheet}; report a file or directory path and optional glob"),
        };
        RuntimeDiagnostic { code, message }
    }
}
