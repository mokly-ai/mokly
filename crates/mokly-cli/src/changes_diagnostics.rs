//! Preserve every historical validation diagnostic when Changes is unavailable.

use mokly_catalogue::diagnostic::Warning;
use mokly_catalogue::error::CatalogueError;
use mokly_compare::error::Error;
use mokly_git::error;

use crate::build::BuildChanges;
use crate::build_output::issue_text;
use crate::changes_output::ChangeDiagnostic;
use crate::codes::Code;
use crate::{changes_policy, render_errors};

const SCRIPTS_HINT: &str = "If this base needs lifecycle scripts, enable `review.baseInstallScripts` or use `--base-install-scripts`";

pub(crate) fn details(error: &Error) -> Vec<ChangeDiagnostic> {
    match error {
        Error::BaseInstallScripts { source } => {
            let mut diagnostics = details(source);
            diagnostics.push(ChangeDiagnostic {
                code: Code::BuildInvalid,
                message: SCRIPTS_HINT.into(),
            });
            diagnostics
        }
        Error::Catalogue {
            source: CatalogueError::Invalid { issues, .. },
        } => issues
            .iter()
            .map(|issue| ChangeDiagnostic {
                code: Code::BuildInvalid,
                message: issue_text(issue, Code::BuildInvalid),
            })
            .collect(),
        Error::Catalogue {
            source: CatalogueError::Config(issue),
        } => vec![ChangeDiagnostic {
            code: Code::ConfigInvalid,
            message: issue_text(issue, Code::ConfigInvalid),
        }],
        Error::Catalogue {
            source: CatalogueError::Runtime { source },
        } => {
            let diagnostic = render_errors::runtime(source);
            vec![ChangeDiagnostic {
                code: diagnostic.code,
                message: diagnostic.message,
            }]
        }
        Error::Graph { source } => render_errors::diagnostics(source)
            .into_iter()
            .map(|diagnostic| ChangeDiagnostic {
                code: diagnostic.code,
                message: diagnostic.message,
            })
            .collect(),
        _ => vec![ChangeDiagnostic {
            code: Code::BuildInvalid,
            message: error.to_string(),
        }],
    }
}

pub(crate) fn warnings(error: &Error) -> Vec<Warning> {
    let records = match error {
        Error::BaseInstallScripts { source } => warnings(source),
        Error::Base { source, .. } => warnings(source),
        Error::Catalogue {
            source: CatalogueError::Invalid { warnings, .. },
        } => warnings.clone(),
        Error::Graph { source } => source.warnings(),
        _ => Vec::new(),
    };
    records
        .into_iter()
        .filter(|warning| warning.code == "base-dependencies")
        .collect()
}

pub(crate) fn unavailable(error: &Error, base_ref: &str) -> Option<BuildChanges> {
    let Error::Base { commit, source } = error else {
        return None;
    };
    if let Some(detail) = limit_detail(source) {
        return Some(BuildChanges::Unavailable {
            base_ref: base_ref.into(),
            base_commit: commit.clone(),
            reason: "comparison limit reached".into(),
            diagnostics: vec![ChangeDiagnostic {
                code: Code::BuildInvalid,
                message: detail,
            }],
        });
    }
    let reason = changes_policy::unavailable(source)?;
    Some(BuildChanges::Unavailable {
        base_ref: base_ref.into(),
        base_commit: commit.clone(),
        reason: reason.into(),
        diagnostics: details(source),
    })
}

pub(crate) fn failure_code(error: &Error) -> Code {
    match error {
        Error::Git { .. } => Code::GitFailed,
        Error::Catalogue {
            source: CatalogueError::Runtime { source },
        } => render_errors::runtime(source).code,
        Error::Graph { source } => changes_policy::failure_code(source),
        Error::Cancelled => Code::BuildInvalid,
        Error::Base { source, .. } => failure_code(source),
        Error::BaseInstallScripts { source } => failure_code(source),
        Error::SourceFailure { source } => failure_code(source),
        _ => Code::ReviewInvalid,
    }
}

fn limit_detail(error: &Error) -> Option<String> {
    match error {
        Error::Limit { path, source } => Some(format!("{path}: {}", plain(&source.to_string()))),
        Error::Base { source, .. } => limit_detail(source),
        Error::BaseInstallScripts { source } => limit_detail(source),
        Error::SourceFailure { source } => limit_detail(source),
        _ => None,
    }
}

fn plain(message: &str) -> &str {
    message
        .strip_prefix('[')
        .and_then(|message| message.split_once("] ").map(|(_, body)| body))
        .unwrap_or(message)
}

pub(crate) fn failure_detail(error: &Error) -> String {
    let detail = match error {
        Error::Git {
            source: error::Error::CommandFailed { status, stderr },
        } => {
            let status = status.map_or_else(
                || "Git ended without an exit status".into(),
                |status| format!("Git exited with status {status}"),
            );
            if stderr.is_empty() {
                status
            } else {
                format!("{status}: {}", String::from_utf8_lossy(stderr).trim())
            }
        }
        Error::Git { source } => plain(&source.to_string()).into(),
        Error::Base { commit, source } => format!("base {commit}: {}", failure_detail(source)),
        Error::BaseInstallScripts { source } => failure_detail(source),
        Error::SourceFailure { source } => failure_detail(source),
        Error::Catalogue {
            source: CatalogueError::Runtime { source },
        } => source.message.clone(),
        Error::Graph { source } => render_errors::diagnostics(source)
            .into_iter()
            .map(|diagnostic| diagnostic.message)
            .collect::<Vec<_>>()
            .join("\n"),
        Error::Cancelled => "build cancelled".into(),
        _ => error.to_string(),
    };
    if matches!(error, Error::BaseInstallScripts { .. }) {
        format!("{detail}. {SCRIPTS_HINT}")
    } else {
        detail
    }
}
