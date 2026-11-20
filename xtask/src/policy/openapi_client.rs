//! Generation and drift checks for the Rust-owned OpenAPI document and client.

use std::path::Path;
use std::sync::Arc;

use crate::command::CommandSpec;
use crate::error::{ErrorResultExt, Result, reject};
use crate::policy::diagnostic::Violation;
use crate::policy::environment::Environment;

/// Committed OpenAPI document, relative to the repository root.
pub(super) const DOCUMENT: &str = "docs/api/openapi.json";
/// Committed TypeScript client, relative to the repository root.
pub(super) const GENERATED: &str = "packages/app/src/api/generated/schema.ts";

/// Generates both API artifacts from Rust, optionally comparing without writing.
pub(super) trait OpenapiGenerator {
    /// Derive both files from Rust; check mode leaves committed files unchanged.
    fn generate(&self, check: bool) -> Result<()>;
}

/// Runs the pinned generators through the workspace's injected IO boundary.
pub(super) struct RustOpenapiGenerator {
    /// Files, subprocesses and developer output for this repository.
    pub(super) environment: Arc<dyn Environment>,
}

impl OpenapiGenerator for RustOpenapiGenerator {
    fn generate(&self, check: bool) -> Result<()> {
        let command =
            CommandSpec::new("cargo").args(["run", "--locked", "-p", "mkc-api", "--", "openapi"]);
        let document = self.output(&command)?;
        if !check {
            self.environment
                .write(Path::new(DOCUMENT), document.as_bytes())?;
            let command = CommandSpec::new("npm").args([
                "run",
                "api:generate",
                "--workspace",
                "@mokly-cloud/app",
            ]);
            let output = self.output(&command)?;
            self.environment.report(output.trim_end());
            return Ok(());
        }
        let command = CommandSpec::new("npm")
            .args([
                "exec",
                "--workspace",
                "@mokly-cloud/app",
                "--",
                "openapi-typescript",
            ])
            .with_input(document.clone());
        let client = self.output(&command)?;
        let mut violations = Vec::new();
        for (path, generated) in [(DOCUMENT, document), (GENERATED, client)] {
            let committed = String::from_utf8(self.environment.read(Path::new(path))?)
                .with_context(|| format!("decode {path}"))?;
            violations.extend(compare(path, &committed, &generated));
        }
        reject(violations)
    }
}

impl RustOpenapiGenerator {
    fn output(&self, command: &CommandSpec) -> Result<String> {
        self.environment.output(command)
    }
}

/// Reports the first differing line, including line endings and missing newlines.
pub(super) fn compare(path: &str, committed: &str, generated: &str) -> Vec<Violation> {
    let mut expected = generated.split_inclusive('\n');
    let mut actual = committed.split_inclusive('\n');
    let mut line = 0;
    loop {
        line += 1;
        match (expected.next(), actual.next()) {
            (None, None) => return Vec::new(),
            (left, right) if left == right => continue,
            (left, right) => {
                return vec![Violation::GeneratedDrift {
                    path: path.into(),
                    line,
                    expected: display_line(left),
                    actual: display_line(right),
                }];
            }
        }
    }
}

fn display_line(line: Option<&str>) -> String {
    match line {
        Some(line) => format!("{line:?}"),
        None => "<end of file>".to_owned(),
    }
}

#[cfg(test)]
#[path = "_tests_/openapi_client_tests.rs"]
mod openapi_client_tests;
