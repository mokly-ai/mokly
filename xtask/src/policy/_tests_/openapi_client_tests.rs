//! In-memory OpenAPI generation, command sequencing and exact drift diagnostics.

use std::path::Path;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use super::{DOCUMENT, GENERATED, OpenapiGenerator, RustOpenapiGenerator, compare};
use crate::command::CommandSpec;
use crate::error::Error;
use crate::policy::diagnostic::Violation;
use crate::policy::environment::{OutputMock, ReadMock, ReportMock, WriteMock};

const DOCUMENT_SOURCE: &str = "{\n  \"openapi\": \"3.1.0\"\n}\n";
const CLIENT_SOURCE: &str = "export interface paths {\n  session: never;\n}\n";

fn derive() -> CommandSpec {
    CommandSpec::new("cargo").args(["run", "--locked", "-p", "mkc-api", "--", "openapi"])
}

fn print_client() -> CommandSpec {
    CommandSpec::new("npm")
        .args([
            "exec",
            "--workspace",
            "@mokly-cloud/app",
            "--",
            "openapi-typescript",
        ])
        .with_input(DOCUMENT_SOURCE.into())
}

fn checker(document: &str, client: &str) -> RustOpenapiGenerator {
    RustOpenapiGenerator {
        environment: Arc::new(Unimock::new((
            OutputMock
                .next_call(matching!((command) if *command == &derive()))
                .returns(Ok(DOCUMENT_SOURCE.to_owned())),
            OutputMock
                .next_call(matching!((command) if *command == &print_client()))
                .returns(Ok(CLIENT_SOURCE.to_owned())),
            ReadMock
                .next_call(matching!((path) if *path == Path::new(DOCUMENT)))
                .returns(Ok(document.as_bytes().to_vec())),
            ReadMock
                .next_call(matching!((path) if *path == Path::new(GENERATED)))
                .returns(Ok(client.as_bytes().to_vec())),
        ))),
    }
}

#[test]
fn check_derives_the_client_from_rust_without_writes() {
    checker(DOCUMENT_SOURCE, CLIENT_SOURCE)
        .generate(true)
        .unwrap();
}

#[test]
fn regeneration_writes_document_before_running_the_app_script() {
    let checker = RustOpenapiGenerator { environment: Arc::new(Unimock::new((
        OutputMock.next_call(matching!((command) if *command == &derive()))
            .returns(Ok(DOCUMENT_SOURCE.to_owned())),
        WriteMock.next_call(matching!((path, bytes) if *path == Path::new(DOCUMENT) && *bytes == DOCUMENT_SOURCE.as_bytes()))
            .returns(Ok(())),
        OutputMock.next_call(matching!((command) if *command == &CommandSpec::new("npm").args(["run", "api:generate", "--workspace", "@mokly-cloud/app"])))
            .returns(Ok("generated\n".to_owned())),
        ReportMock.next_call(matching!("generated")).returns(()),
    ))) };
    assert!(checker.generate(false).is_ok());
}

#[test]
fn both_outputs_report_the_first_difference_even_if_committed_document_is_stale() {
    let Err(Error::Violations(violations)) = checker("stale\n", "old client\n").generate(true)
    else {
        panic!("expected drift");
    };
    assert_eq!(
        violations,
        [
            Violation::GeneratedDrift {
                path: DOCUMENT.into(),
                line: 1,
                expected: "\"{\\n\"".into(),
                actual: "\"stale\\n\"".into()
            },
            Violation::GeneratedDrift {
                path: GENERATED.into(),
                line: 1,
                expected: "\"export interface paths {\\n\"".into(),
                actual: "\"old client\\n\"".into()
            },
        ]
    );
}

#[test]
fn missing_lines_and_line_endings_are_drift() {
    for (actual, expected, line) in [
        ("first\n", "first\nsecond\n", 2),
        ("first\nsecond\n", "first\n", 2),
        ("first", "first\n", 1),
        ("first\r\n", "first\n", 1),
        ("first \n", "first\n", 1),
    ] {
        let violations = compare(GENERATED, actual, expected);
        assert!(
            matches!(violations.as_slice(), [Violation::GeneratedDrift { line: found, .. }] if *found == line)
        );
    }
}

#[test]
fn rust_failure_stops_before_any_write_or_client_generation() {
    let checker = RustOpenapiGenerator {
        environment: Arc::new(Unimock::new(
            OutputMock
                .next_call(matching!((command) if *command == &derive()))
                .returns(Err(Error::CommandOutput {
                    command: "cargo".into(),
                    code: Some(1),
                    stdout: String::new(),
                    stderr: "derive failed".into(),
                })),
        )),
    };
    assert!(matches!(checker.generate(false),
        Err(Error::CommandOutput { stderr, .. }) if stderr == "derive failed"));
}

#[test]
fn client_failure_stops_before_comparing_committed_files() {
    let checker = RustOpenapiGenerator {
        environment: Arc::new(Unimock::new((
            OutputMock
                .next_call(matching!((command) if *command == &derive()))
                .returns(Ok(DOCUMENT_SOURCE.to_owned())),
            OutputMock
                .next_call(matching!((command) if *command == &print_client()))
                .returns(Err(Error::CommandOutput {
                    command: "npm".into(),
                    code: Some(1),
                    stdout: String::new(),
                    stderr: "client failed".into(),
                })),
        ))),
    };
    assert!(matches!(checker.generate(true),
        Err(Error::CommandOutput { stderr, .. }) if stderr == "client failed"));
}
