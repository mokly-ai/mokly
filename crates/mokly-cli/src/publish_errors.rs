//! Safe publication categories and bounded checkout recovery details.

use std::collections::BTreeSet;

use mokly_publish::build_failure::Category;
use mokly_publish::error::Error;

use crate::codes::Code;
use crate::output::{Mode, Style, bounded};
use crate::redaction::Redactor;

/// Render publication failures without revealing credentials or transport sources.
pub fn render(error: &Error, style: &Style, redactor: &Redactor) -> String {
    let (code, detail) = match error {
        Error::Build { failure } => {
            let code = match failure.category() {
                Category::BuildInvalid => Code::BuildInvalid,
                Category::ConfigInvalid => Code::ConfigInvalid,
                Category::ConfigMissing => Code::ConfigMissing,
                Category::ExportInvalid => Code::ExportInvalid,
                Category::GitFailed => Code::GitFailed,
                Category::ReviewInvalid => Code::ReviewInvalid,
            };
            return style.error(code, &failure.detail(), redactor);
        }
        Error::UnsupportedVersion if style.mode == Mode::Rich => {
            (Code::UploadUnsupportedVersion, "")
        }
        Error::InvalidBundle => (
            Code::UploadInvalidBundle,
            "The catalogue upload is invalid. Rebuild the catalogue and retry.",
        ),
        Error::TooLarge => (
            Code::UploadTooLarge,
            "The catalogue is too large to publish. Reduce the output size or raise the receiver limit.",
        ),
        Error::UnsupportedVersion => (
            Code::UploadUnsupportedVersion,
            "The catalogue service does not support this Mokly version. Update the service and try again.",
        ),
        Error::Unauthorized => (
            Code::UploadUnauthorized,
            "The catalogue upload was not authorized. Check the token and repository access.",
        ),
        Error::Failed | Error::Replan => (
            Code::UploadFailed,
            "The catalogue could not be published. Check the endpoint and connection, then retry.",
        ),
        Error::Transport => (Code::UploadTransport, ""),
        Error::Cancelled => (Code::UploadCancelled, ""),
        Error::Endpoint => (
            Code::CliInvalid,
            "publish endpoint must be an HTTP(S) URL without credentials or a fragment",
        ),
        Error::Token => (
            Code::CliInvalid,
            "publish token must use the bearer-token grammar",
        ),
        Error::Concurrency => (
            Code::CliInvalid,
            "upload concurrency must be an integer from 1 through 32",
        ),
        Error::Checkout => (
            Code::GitFailed,
            "Publish requires a Git checkout with a committed HEAD.",
        ),
        Error::Git { .. } => (
            Code::GitFailed,
            "Git information could not be read. Check the repository and configured base.",
        ),
        Error::HeadChanged => (
            Code::GitFailed,
            "HEAD changed during the build. Run mokly publish again.",
        ),
        Error::Repository => (
            Code::GitFailed,
            "The repository could not be identified. Set --repository to host/owner/name.",
        ),
        Error::Uncommitted {
            paths,
            during_build,
            build_directories,
        } => {
            return uncommitted(paths, *during_build, build_directories, style, redactor);
        }
        Error::StaticUnavailable => {
            return "[mokly/build-invalid] Static output is not available in this build.\n"
                .to_owned();
        }
        Error::BuildWarnings => (
            Code::BuildInvalid,
            "The catalogue has build warnings. Fix the reported warnings and retry.",
        ),
        Error::Internal(_) => (
            Code::UploadFailed,
            "The catalogue could not be prepared for publication. Rebuild the catalogue and retry.",
        ),
    };
    style.error(code, detail, redactor)
}

/// Render at most twenty unique sorted paths, with literal Git ignore patterns.
pub fn uncommitted(
    paths: &[String],
    during_build: bool,
    build_directories: &[String],
    style: &Style,
    redactor: &Redactor,
) -> String {
    let mut paths: Vec<_> = paths.iter().collect::<BTreeSet<_>>().into_iter().collect();
    paths.sort_by(|left, right| left.encode_utf16().cmp(right.encode_utf16()));
    let (_, headline, hint) = Code::GitUncommitted.presentation();
    let mut details = Vec::new();
    if during_build {
        details.push("Changes appeared during the build.".to_owned());
    }
    details.extend(
        paths
            .iter()
            .take(20)
            .map(|path| format!("  - {}", redactor.safe(path))),
    );
    if paths.len() > 20 {
        let count = paths.len() - 20;
        details.push(format!(
            "  … {count} other {}.",
            if count == 1 { "path" } else { "paths" }
        ));
    }
    let rules: BTreeSet<_> = build_directories
        .iter()
        .filter(|directory| {
            paths.iter().any(|path| {
                path.strip_prefix(directory.as_str())
                    .is_some_and(|suffix| suffix.starts_with('/'))
            })
        })
        .map(|directory| ignore_rule(directory))
        .collect();
    if !rules.is_empty() {
        details.push("Add these rules to the repository's .gitignore:".to_owned());
        details.extend(
            rules
                .iter()
                .map(|rule| format!("  {}", redactor.safe(rule))),
        );
    }
    if style.mode == Mode::Plain {
        let details = if details.is_empty() {
            String::new()
        } else {
            format!("{}\n", details.join("\n"))
        };
        return format!("[mokly/git-uncommitted] {headline}\n{details}{hint}\n");
    }
    let mut output = style.error(Code::GitUncommitted, "", redactor);
    let hint_line = output
        .rfind('\n')
        .and_then(|end| output[..end].rfind('\n'))
        .map(|index| index + 1)
        .unwrap_or(0);
    let detail = details
        .iter()
        .map(|line| format!("{}\n", bounded(&format!("  {line}"), style.columns)))
        .collect::<String>();
    output.insert_str(hint_line, &detail);
    output
}

fn ignore_rule(directory: &str) -> String {
    let directory: String = directory
        .chars()
        .map(|character| {
            if "\\*?[]!#".contains(character) {
                format!("\\{character}")
            } else {
                character.to_string()
            }
        })
        .collect();
    format!("/{directory}/")
}

#[cfg(test)]
#[path = "_tests_/publish_errors_tests.rs"]
mod publish_errors_tests;
