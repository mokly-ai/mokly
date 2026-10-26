//! Rich recovery paths stay complete at the default 80 columns.

use std::fs;
use std::path::Path;

use mokly_test_support::publication::temporary_root;

use super::support::{
    fault_command, joined, output_directory, private_outputs, recovery_fixture, reservation,
};

fn rich_paths_remain_complete(verb: &str, fault: &str) {
    let root = recovery_fixture();
    let path = root.path();
    let temporary = tempfile::tempdir_in(temporary_root()).unwrap();
    let long_name = "retained-output-".repeat(6);
    let temporary_root = temporary.path().join(&long_name);
    fs::create_dir(&temporary_root).unwrap();
    let requested = format!(".context/{long_name}/site");
    fs::create_dir_all(path.join(Path::new(&requested).parent().unwrap())).unwrap();
    let result = fault_command(path, verb, fault, "rich", &requested)
        .env_remove("MOKLY_TEST_STATIC_COLUMNS")
        .env("TMPDIR", &temporary_root)
        .env("TMP", &temporary_root)
        .env("TEMP", &temporary_root)
        .run();
    let output = if verb == "build" {
        joined(path, &requested)
    } else {
        output_directory(path, verb, &result.stdout)
    };
    let _private = private_outputs(verb, &output);
    assert_eq!(result.code, Some(1), "{}", result.stderr);
    let retained = if fault == "install,restore" {
        reservation(&output).join("backup")
    } else {
        reservation(&output)
    };
    let displayed = if verb == "build" {
        retained.strip_prefix(path).unwrap().display().to_string()
    } else {
        retained.display().to_string()
    };
    assert!(displayed.len() > 80);
    assert!(
        result
            .stderr
            .split('\n')
            .any(|line| line == format!("  Recovery path: {displayed}")),
        "{}",
        result.stderr
    );
    if verb == "publish" {
        assert!(output.display().to_string().len() > 80);
        assert!(
            result
                .stdout
                .split('\n')
                .any(|line| line == format!("Mokly publish build: {}", output.display()))
        );
    } else {
        assert!(
            !result
                .stderr
                .contains(&format!("Recovery path: {}", path.display()))
        );
    }
}

#[test]
fn build_rich_install_restore_paths_remain_complete_at_the_default_80_columns() {
    rich_paths_remain_complete("build", "install,restore");
}

#[test]
fn build_rich_reservation_cleanup_paths_remain_complete_at_the_default_80_columns() {
    rich_paths_remain_complete("build", "reservation-cleanup");
}

#[test]
fn publish_rich_install_restore_paths_remain_complete_at_the_default_80_columns() {
    rich_paths_remain_complete("publish", "install,restore");
}

#[test]
fn publish_rich_reservation_cleanup_paths_remain_complete_at_the_default_80_columns() {
    rich_paths_remain_complete("publish", "reservation-cleanup");
}
