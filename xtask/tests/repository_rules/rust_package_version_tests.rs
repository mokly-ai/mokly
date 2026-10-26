//! Rust package-version paths use the npm-derived shared version.

use std::fs;

use walkdir::WalkDir;

use crate::rust_package_version::rust_package_version_problems;
use crate::support::repository_root;

#[test]
fn rust_package_version_paths_cannot_use_the_independent_cargo_crate_version() {
    let root = repository_root();
    let mut failures = Vec::new();
    for entry in WalkDir::new(root.join("crates")).min_depth(1) {
        let entry = entry.unwrap();
        let is_rust = entry
            .file_name()
            .to_str()
            .is_some_and(|name| name.ends_with(".rs"));
        if !entry.file_type().is_file() || !is_rust {
            continue;
        }
        let source = fs::read_to_string(entry.path()).unwrap();
        if !rust_package_version_problems(&source).is_empty() {
            failures.push(
                entry
                    .path()
                    .strip_prefix(&root)
                    .unwrap()
                    .display()
                    .to_string(),
            );
        }
    }
    assert_eq!(
        failures,
        Vec::<String>::new(),
        "Use the shared version derived from packages/mokly/package.json, including hello, cache keys, user-agent, and Rust test expectations."
    );
}

#[test]
fn the_version_detector_flags_every_cargo_version_token_and_valueless_clap_version() {
    for source in [
        r#"env!("CARGO_PKG_VERSION")"#,
        r#"option_env!("CARGO_PKG_VERSION")"#,
        r#"std::env::var("CARGO_PKG_VERSION")"#,
        r#"std::env::var_os("CARGO_PKG_VERSION")"#,
        r#"env!("CARGO_PKG_VERSION_MAJOR")"#,
        r#"// env!("CARGO_PKG_VERSION")"#,
        "#[command(version)]",
        "#[clap(author, version, about)]",
        "#[command(\n name = \"mokly\",\n version,\n)]",
        "#[clap(r#version)]",
        r##"#[command(about = r#"help"#, version)]"##,
        "#[command(short_flag = '(', version)]",
        "#[command(about = { nested(1, 2) }, version)]",
    ] {
        assert!(
            !rust_package_version_problems(source).is_empty(),
            "{source}"
        );
    }
}

#[test]
fn the_version_detector_accepts_an_explicit_package_version_and_ignores_quoted_clap_examples() {
    let none: [&str; 0] = [];
    for source in [
        "#[command(version = crate::version::VERSION)]",
        r#"#[clap(version = env!("MOKLY_VERSION"))]"#,
        r#"#[command(about = "text, version, text")] "#,
        "// #[command(version)]",
        "/* outer /* nested */ #[clap(version)] */",
        r###"const DOC: &str = r##"#[command(version)]"##;"###,
        r##"const DOC: &[u8] = br#"#[clap(version)]"#;"##,
        "#[command(about = { nested(version, other) }, version = VERSION)]",
    ] {
        assert_eq!(rust_package_version_problems(source), none, "{source}");
    }
}
