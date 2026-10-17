//! Verify emitted MSVC linker options without a hosted Windows build.

#[path = "../build.rs"]
mod build_script;

#[test]
fn msvc_binary_reserves_eight_mib_without_changing_other_targets() {
    for (os, environment, expected) in [
        ("windows", "msvc", true),
        ("windows", "gnu", false),
        ("linux", "gnu", false),
        ("macos", "", false),
    ] {
        let mut output = Vec::new();
        build_script::emit(os, environment, &mut output).unwrap();
        let output = String::from_utf8(output).unwrap();
        assert_eq!(
            output
                .lines()
                .filter(|line| *line == "cargo:rustc-link-arg-bins=/STACK:8388608")
                .count(),
            usize::from(expected)
        );
        assert!(output.contains("cargo:rustc-env=MOKLY_VERSION="));
    }
}
