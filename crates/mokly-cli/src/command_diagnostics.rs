//! Optional diagnostics show retained causes and supplied JavaScript stack text.

use std::env;
use std::error::Error;

use mokly_cli::build::BuildError;
use mokly_cli::publication;
use mokly_cli::redaction::Redactor;
use mokly_cli::static_errors::display_path;
use mokly_cli::static_errors::without_prefixes;
use mokly_static::error;

use crate::terminal::Terminal;

pub(super) fn emit(error: &(dyn Error + 'static), terminal: &dyn Terminal, redactor: &Redactor) {
    if env::var("MOKLY_DIAGNOSTIC").ok().as_deref() == Some("1") {
        terminal.stderr(&causes(error, redactor));
    }
}

fn causes(error: &(dyn Error + 'static), redactor: &Redactor) -> String {
    let mut output = String::from("Diagnostic causes:\n");
    let mut pending = vec![error];
    while let Some(cause) = pending.pop() {
        let combined = match cause.downcast_ref::<BuildError>() {
            Some(BuildError::Shutdown { primary, shutdown }) => {
                pending.push(shutdown.as_ref());
                pending.push(primary.as_ref());
                Some("Render shutdown failed".to_owned())
            }
            Some(BuildError::Cleanup {
                primary,
                cleanup,
                path,
            }) => {
                pending.push(cleanup.as_ref());
                pending.push(primary.as_ref());
                Some(format!(
                    "Output cleanup failed; retained recovery path {}",
                    display_path(path)
                ))
            }
            _ => match cause.downcast_ref::<error::Error>() {
                Some(error::Error::Recovery {
                    primary,
                    cleanup,
                    path,
                }) => {
                    pending.push(cleanup.as_ref());
                    pending.push(primary.as_ref());
                    Some(format!(
                        "Output recovery failed; retained recovery path {}",
                        display_path(path)
                    ))
                }
                Some(error::Error::Installed { source, path }) => {
                    pending.push(source.as_ref());
                    Some(format!(
                        "The new site is installed; cleanup failed; retained recovery path {}",
                        display_path(path)
                    ))
                }
                _ => None,
            },
        };
        if let Some(context) = combined {
            output.push_str(&format!("  {}\n", redactor.safe(&context)));
            continue;
        }
        let message = without_prefixes(&cause.to_string());
        let current: Option<&(dyn Error + 'static)> =
            match cause.downcast_ref::<publication::error::Error>() {
                Some(publication::error::Error::Build { failure }) => Some(failure.as_ref()),
                _ => cause.source(),
            };
        if let Some(source) = current {
            pending.push(source);
        }
        let nested = current.map(|source| without_prefixes(&source.to_string()));
        let detail = nested
            .as_ref()
            .and_then(|nested| message.strip_suffix(nested))
            .unwrap_or(&message)
            .trim_end_matches([':', ' ']);
        for line in detail.lines() {
            output.push_str(&format!("  {}\n", redactor.safe(line)));
        }
    }
    output
}

#[cfg(test)]
#[path = "_tests_/command_diagnostics_tests.rs"]
mod tests;
