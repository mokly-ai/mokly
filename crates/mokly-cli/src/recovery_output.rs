//! Complete recovery paths bypass terminal width limits and retain safe display text.

use std::path::Path;

use mokly_static::error::Error;

use crate::build::BuildError;
use crate::redaction::Redactor;
use crate::static_errors::{detail, display_path, without_prefixes};

/// Display a path relative to the invocation directory only when it is inside it.
pub fn path(path: &Path, cwd: &Path, redactor: &Redactor) -> String {
    let relative = path.strip_prefix(cwd).unwrap_or(path);
    let relative = if relative.as_os_str().is_empty() {
        Path::new(".")
    } else {
        relative
    };
    redactor.safe(&display_path(relative))
}

pub fn build(error: &BuildError, cwd: &Path, redactor: &Redactor) -> String {
    let mut paths = Vec::new();
    collect_build(error, &mut paths);
    let mut seen = Vec::new();
    let mut output = String::new();
    for recovery in paths {
        if !seen.contains(&recovery) {
            output.push_str(&format!(
                "  Recovery path: {}\n",
                path(recovery, cwd, redactor)
            ));
            seen.push(recovery);
        }
    }
    output
}

pub(crate) fn cause(error: &BuildError) -> String {
    match error {
        BuildError::Static { source } => detail(source),
        BuildError::Interrupted { source } => cause(source),
        BuildError::Cleanup {
            primary, cleanup, ..
        } => {
            format!("{}\nRecovery failed: {}", cause(primary), detail(cleanup))
        }
        BuildError::Shutdown { primary, shutdown } => {
            format!(
                "{}\nRender shutdown failed: {}",
                cause(primary),
                cause(shutdown)
            )
        }
        _ => without_prefixes(&error.to_string()),
    }
}

fn collect_build<'a>(error: &'a BuildError, paths: &mut Vec<&'a Path>) {
    match error {
        BuildError::Static { source } => collect_static(source, paths),
        BuildError::Cleanup {
            primary,
            cleanup,
            path,
        } => {
            collect_build(primary, paths);
            collect_static(cleanup, paths);
            paths.push(path);
        }
        BuildError::Shutdown { primary, shutdown } => {
            collect_build(primary, paths);
            collect_build(shutdown, paths);
        }
        _ => {}
    }
}

fn collect_static<'a>(error: &'a Error, paths: &mut Vec<&'a Path>) {
    match error {
        Error::Recovery {
            primary,
            cleanup,
            path,
        } => {
            collect_static(primary, paths);
            collect_static(cleanup, paths);
            paths.push(path);
        }
        Error::Installed { source, path } => {
            collect_static(source, paths);
            paths.push(path);
        }
        Error::Reserved { path } => paths.push(path),
        _ => {}
    }
}

#[cfg(test)]
#[path = "_tests_/recovery_output_tests.rs"]
mod recovery_output_tests;
