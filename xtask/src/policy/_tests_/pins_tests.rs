//! Failing pin-file and protocol-table fixtures.

use std::path::Path;

use crate::policy::build_pins::{e2b_node, mokly};
use crate::policy::diagnostic::Violation;

use super::{Pins, package, protocol, rust};

fn pins() -> Pins {
    Pins {
        rust: "1.98.1".into(),
        node: "24.14.1".into(),
        npm: "11.11.0".into(),
        tar: "7.5.22".into(),
        terraform: "1.16.2".into(),
        helm: "4.3.0".into(),
    }
}

#[test]
fn protocol_requires_one_row_per_version() {
    let table = "| Rust | 1.98.1 | file |\n| Node | 24.14.1 | file |\n| npm | 11.11.0 | file |\n| tar | 7.5.22 | file |\n| Terraform | 1.16.2 | file |\n| Helm | 4.3.0 | file |\n";
    assert_eq!(protocol(table).ok().unwrap().node, "24.14.1");
    assert!(protocol(&table.replace("| npm |", "| missing |")).is_err());
    assert!(protocol(&format!("{table}| Rust | 1.98.1 | extra |\n")).is_err());
}

#[test]
fn rejects_wrong_rust_and_missing_component() {
    let text = "[toolchain]\nchannel = '1.98.1'\ncomponents = ['rustfmt', 'clippy']\n";
    assert!(rust(text, &pins()).unwrap().is_empty());
    assert_eq!(
        rust(&text.replace("1.98.1", "1.97.0"), &pins())
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        rust(&text.replace("'clippy'", "'rust-src'"), &pins())
            .unwrap()
            .len(),
        1
    );
    assert!(rust("[toolchain]", &pins()).is_err());
}

#[test]
fn rejects_disagreeing_npm_manager() {
    let text = r#"{"packageManager":"npm@11.11.0","devDependencies":{"tar":"7.5.22"}}"#;
    assert!(
        package(Path::new("package.json"), text, &pins())
            .unwrap()
            .is_empty()
    );
    assert_eq!(
        package(
            Path::new("package.json"),
            &text.replace("11.11.0", "11.0.0"),
            &pins()
        )
        .unwrap(),
        [Violation::PinMismatch {
            path: "package.json".into(),
            field: "packageManager".into(),
            expected: "npm@11.11.0".into(),
            actual: "npm@11.0.0".into()
        }]
    );
}

#[test]
fn fixture_packer_must_match_the_documented_pin() {
    let text = r#"{"engines":{"node":">=24.14.1 <25"},"packageManager":"npm@11.11.0","devDependencies":{"tar":"7.5.22"}}"#;
    let path = Path::new("package.json");
    assert!(package(path, text, &pins()).unwrap().is_empty());
    assert_eq!(
        package(path, &text.replace("7.5.22", "7.5.23"), &pins())
            .unwrap()
            .len(),
        1
    );
}

#[test]
fn cloud_cli_must_match_the_package_and_meet_the_floor() {
    let package =
        r#"{"engines":{"node":">=24.21.0 <25"},"packageManager":"npm@11.11.0","version":"0.13.0"}"#;
    let source = "pub const CLOUD_MOKLY_VERSION: &str = \"0.13.0\";\npub const MIN_MOKLY_VERSION: &str = \"0.13.0\";\n";
    assert!(mokly(package, source).unwrap().is_empty());
    assert_eq!(
        mokly(&package.replace("0.13.0", "0.14.0"), source)
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        mokly(package, &source.replacen("0.13.0", "0.12.0", 1))
            .unwrap()
            .len(),
        2
    );
    for source in [
        source.replace("CLOUD_MOKLY_VERSION", "WRONG"),
        source.replace("0.13.0", "invalid"),
        format!("{source}{source}"),
    ] {
        assert!(!mokly(package, &source).unwrap().is_empty());
    }
    assert!(
        !mokly(package, &source.replacen("0.13.0", "0.13.0-alpha.1", 1))
            .unwrap()
            .is_empty()
    );
}

#[test]
fn build_template_node_must_match_nvmrc_exactly() {
    let definition = "FROM e2bdev/base\nARG NODE_VERSION=24.21.0\n";
    assert!(e2b_node(definition, "24.21.0\n").is_empty());
    let violations = e2b_node(&definition.replace("24.21.0", "24.18.0"), "24.21.0");
    assert_eq!(violations.len(), 1);
    for source in [
        definition.replace("NODE_VERSION", "WRONG"),
        format!("{definition}ARG NODE_VERSION=24.21.0\n"),
        definition.replace("24.21.0", "24"),
        definition.replace("24.21.0", ""),
    ] {
        assert!(!e2b_node(&source, "24.21.0").is_empty());
    }
}
