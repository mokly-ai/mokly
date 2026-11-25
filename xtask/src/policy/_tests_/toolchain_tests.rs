//! The complete toolchain policy rejects drift at its injected IO boundary.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::command::CommandSpec;
use crate::error::Error;
use crate::policy::diagnostic::Violation;
use crate::policy::environment::{OutputMock, ReadMock};

use super::ToolchainCheck;

const DOCKERFILE: &str = "FROM e2bdev/base:2026@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\nARG NODE_VERSION=24.21.0\n";
const NEXTEST: &str = "nextest-version = { required = \"0.9.152\" }\n";
const WORKFLOW: &str = "        with:\n          tool: cargo-nextest@0.9.152\n";
const VERSIONS: &str = "pub const MIN_MOKLY_VERSION: &str = \"0.18.0\";\n";
const SENTENCE: &str =
    "unsupported-mokly-version: Update `@mokly/mokly` to 0.18.0 or later to publish.\n";

fn check(replacement: Option<(&str, &str)>) -> Result<(), Error> {
    let mut files: BTreeMap<String, Vec<u8>> = [
        ("docs/protocol/cloud/repository-layout.md", "| Rust | 1.98.0 |\n| Node | 24.21.0 |\n| npm | 11.21.0 |\n| tar | 7.5.22 |\n| Terraform | 1.16.2 |\n| Helm | 4.3.0 |\n| cargo-nextest | 0.9.152 |\n"),
        ("rust-toolchain.toml", "[toolchain]\nchannel = '1.98.0'\ncomponents = ['rustfmt', 'clippy']\n"),
        (".nvmrc", "24.21.0\n"),
        ("infra/e2b/build/e2b.Dockerfile", DOCKERFILE),
        ("package.json", r#"{"packageManager":"npm@11.21.0","devDependencies":{"tar":"7.5.22"}}"#),
        ("packages/mokly/package.json", r#"{"version":"0.19.0"}"#),
        ("crates/mkc-build-sandbox/src/versions.rs", VERSIONS),
        ("docs/protocol/cloud/viewer-builds.md", SENTENCE),
        ("packages/app/src/viewer/build-copy.ts", SENTENCE),
        ("docs/mockups/src/fixtures/build-copy.ts", SENTENCE),
        ("infra/toolchains.json", r#"{"terraform":"1.16.2","helm":"4.3.0"}"#),
        (".config/nextest.toml", NEXTEST),
        (".github/workflows/ci.yml", WORKFLOW),
        (".github/workflows/blacksmith-testbox.yml", WORKFLOW),
    ].into_iter().map(|(path, text)| (path.to_owned(), text.as_bytes().to_vec())).collect();
    if let Some((path, text)) = replacement {
        files.insert(path.to_owned(), text.as_bytes().to_vec());
    }
    let environment = Arc::new(Unimock::new((
        ReadMock
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path: &Path| {
                Ok(files.get(path.to_str().unwrap()).unwrap().clone())
            })),
        OutputMock
            .each_call(matching!(_))
            .answers_arc(Arc::new(|_, command: &CommandSpec| {
                Ok(match command.display().as_str() {
                    "node xtask/scripts/node-pin.mjs 24.21.0" => "",
                    "terraform version -json" => r#"{"terraform_version":"1.16.2"}"#,
                    "helm version --template \"{{.Version}} \"" => "v4.3.0 ",
                    "rustc --version" => "rustc 1.98.0 (fixture)",
                    "node --version" => "v24.21.0",
                    "npm --version" => "11.21.0",
                    "cargo nextest --version" => {
                        "cargo-nextest 0.9.152 (fixture)\nrelease: 0.9.152"
                    }
                    other => panic!("unexpected command: {other}"),
                }
                .to_owned())
            })),
    )));
    ToolchainCheck { environment }.check()
}

#[test]
fn toolchain_stage_rejects_disagreeing_pin_files() {
    check(None).unwrap();
    let changes = [
        (
            "infra/e2b/build/e2b.Dockerfile",
            DOCKERFILE.replace("24.21.0", "24.18.0"),
            "NODE_VERSION",
            "24.21.0",
        ),
        (".nvmrc", "24.0.0\n".into(), "version", "24.21.0"),
        (
            "packages/mokly/package.json",
            r#"{"version":"0.0.0"}"#.into(),
            "version",
            ">= 0.18.0",
        ),
        (
            "crates/mkc-build-sandbox/src/versions.rs",
            VERSIONS.replace("0.18.0", "1.0.0"),
            "version",
            ">= 1.0.0",
        ),
        (
            "infra/e2b/build/e2b.Dockerfile",
            "FROM e2bdev/base:latest\nARG NODE_VERSION=24.21.0\n".into(),
            "FROM",
            "e2bdev/base:<tag>@sha256:<64 lowercase hex>",
        ),
        (
            "docs/protocol/cloud/viewer-builds.md",
            SENTENCE.replace("0.18.0", "0.17.0"),
            "unsupported-mokly-version sentence",
            "0.18.0",
        ),
        (
            "packages/app/src/viewer/build-copy.ts",
            SENTENCE.replace("0.18.0", "0.17.0"),
            "unsupported-mokly-version sentence",
            "0.18.0",
        ),
        (
            "docs/mockups/src/fixtures/build-copy.ts",
            SENTENCE.replace("0.18.0", "0.17.0"),
            "unsupported-mokly-version sentence",
            "0.18.0",
        ),
        (
            ".config/nextest.toml",
            NEXTEST.replace("0.9.152", "0.9.150"),
            "nextest-version.required",
            "0.9.152",
        ),
        (
            ".github/workflows/blacksmith-testbox.yml",
            WORKFLOW.replace("0.9.152", "0.9.150"),
            "cargo-nextest install",
            "0.9.152",
        ),
    ];
    for (path, text, expected_field, expected_value) in changes {
        let Err(Error::Violations(violations)) = check(Some((path, &text))) else {
            panic!("expected a pin violation for {path}");
        };
        assert!(violations.iter().any(|violation| matches!(violation, Violation::PinMismatch {field, expected, ..} if field == expected_field && expected == expected_value)), "{path}: {violations:?}");
    }
}
