//! Cargo metadata rejects every dependency kind and renamed cloud dependencies.

use std::path::PathBuf;

use crate::policy::diagnostic::Violation;

use super::validate;

#[test]
fn rust_boundary_rejects_normal_dev_build_and_renamed_cloud_dependencies() {
    let metadata = r#"{"packages":[
      {"name":"mokly-cli","manifest_path":"crates/mokly-cli/Cargo.toml","dependencies":[
        {"name":"mkc-domain","kind":null,"rename":"hidden"},
        {"name":"mkc-api","kind":"dev"},
        {"name":"mkc-db","kind":"build"}]},
      {"name":"xtask","manifest_path":"xtask/Cargo.toml","dependencies":[{"name":"mkc-domain","kind":"dev"}]},
      {"name":"mkc-api","manifest_path":"crates/mkc-api/Cargo.toml","dependencies":[{"name":"mokly-model"},{"name":"mkc-db"}]}
    ]}"#;
    assert_eq!(
        validate(metadata).unwrap(),
        [
            Violation::CloudDependency {
                path: PathBuf::from("crates/mokly-cli/Cargo.toml"),
                dependency: "mkc-domain".into()
            },
            Violation::CloudDependency {
                path: PathBuf::from("crates/mokly-cli/Cargo.toml"),
                dependency: "mkc-api".into()
            },
            Violation::CloudDependency {
                path: PathBuf::from("crates/mokly-cli/Cargo.toml"),
                dependency: "mkc-db".into()
            },
            Violation::CloudDependency {
                path: PathBuf::from("xtask/Cargo.toml"),
                dependency: "mkc-domain".into()
            },
        ]
    );
}
