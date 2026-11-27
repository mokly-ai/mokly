//! Git status for exact working paths, including paths across checkout boundaries.

use std::fs;

use mokly_git::identity::RepoPath;
use mokly_git::repository::WorkingPathStatus;

mod support;

use support::Fixture;

#[test]
fn working_path_status_reports_tracked_files_even_when_an_ignore_rule_matches() {
    let fixture = Fixture::new();
    fixture.write("skin.css", b"tracked");
    fixture.commit();
    fixture.write(".gitignore", b"/skin.css\n");

    assert_eq!(
        statuses(&fixture, &["skin.css"]),
        [WorkingPathStatus::Tracked]
    );
}

#[test]
fn working_path_status_reports_new_files_with_negated_ignore_rules_as_untracked() {
    let fixture = Fixture::new();
    fixture.write(".gitignore", b"*.css\n!/styles/fresh.css\n");
    fixture.write("styles/fresh.css", b"new");

    assert_eq!(
        statuses(&fixture, &["styles/fresh.css"]),
        [WorkingPathStatus::Untracked]
    );
}

#[test]
fn working_path_status_reports_files_under_an_ignored_directory_as_ignored() {
    let fixture = Fixture::new();
    fixture.write(".gitignore", b"/generated/\n");
    fixture.write("generated/styles/skin.css", b"ignored");
    fixture.git(&["init", "-b", "main", "generated/checkout"]);
    fixture.write("generated/checkout/skin.css", b"ignored nested checkout");

    assert_eq!(
        statuses(
            &fixture,
            &["generated/styles/skin.css", "generated/checkout/skin.css"]
        ),
        [WorkingPathStatus::Ignored, WorkingPathStatus::Ignored]
    );
}

#[test]
fn working_path_status_names_the_unignored_nested_checkout() {
    let fixture = Fixture::new();
    fixture.write("replaced", b"tracked file");
    fixture.commit();
    fixture.git(&["init", "-b", "main", "vendor/theme"]);
    fixture.write("vendor/theme/styles/skin.css", b"nested");
    fixture.write("vendor/theme-neighbor/skin.css", b"untracked sibling");
    fs::remove_file(fixture.root().join("replaced")).unwrap();
    fixture.git(&["init", "-b", "main", "replaced"]);
    fixture.write("replaced/styles/skin.css", b"nested at a stale index entry");

    assert_eq!(
        statuses(
            &fixture,
            &[
                "vendor/theme/styles/skin.css",
                "vendor/theme-neighbor/skin.css",
                "replaced/styles/skin.css",
            ]
        ),
        [
            WorkingPathStatus::NestedRepository(path("vendor/theme")),
            WorkingPathStatus::Untracked,
            WorkingPathStatus::NestedRepository(path("replaced")),
        ]
    );
}

#[test]
fn working_path_status_names_a_submodule_from_the_index_before_commit() {
    let source = Fixture::new();
    source.write("styles/skin.css", b"submodule");
    source.commit();
    let fixture = Fixture::new();
    fixture.commit();
    fixture.git(&[
        "-c",
        "protocol.file.allow=always",
        "submodule",
        "add",
        source.root().to_str().unwrap(),
        "vendor/theme",
    ]);

    assert_eq!(
        statuses(&fixture, &["vendor/theme/styles/skin.css"]),
        [WorkingPathStatus::Submodule(path("vendor/theme"))]
    );
}

#[test]
fn working_path_status_checks_the_file_below_a_stale_index_entry() {
    let fixture = Fixture::new();
    fixture.write(".gitignore", b"/replaced/skin.css\n");
    fixture.write("replaced", b"tracked file");
    fixture.commit();
    fs::remove_file(fixture.root().join("replaced")).unwrap();
    fixture.write("replaced/skin.css", b"ignored replacement");
    fixture.write("replaced/fresh.css", b"untracked replacement");

    assert_eq!(
        statuses(&fixture, &["replaced/skin.css", "replaced/fresh.css"]),
        [WorkingPathStatus::Ignored, WorkingPathStatus::Untracked]
    );
}

#[test]
fn working_path_status_uses_the_first_link_in_a_written_path() {
    let fixture = Fixture::new();
    fixture.write("source/styles/skin.css", b"tracked target");
    fixture.write(".gitignore", b"/ignored-link\n");
    fixture.commit();
    let root = fixture.root();
    for link in ["ignored-link", "new-link", "tracked-link"] {
        let target = root.join("source");
        let link = root.join(link);
        #[cfg(unix)]
        std::os::unix::fs::symlink(&target, &link).unwrap();
        #[cfg(windows)]
        std::os::windows::fs::symlink_dir(&target, &link).unwrap();
    }
    fixture.git(&["add", "tracked-link"]);

    assert_eq!(
        statuses(
            &fixture,
            &[
                "tracked-link/styles/skin.css",
                "ignored-link/styles/skin.css",
                "source/styles/skin.css",
                "new-link/styles/skin.css",
                "ignored-link/styles/skin.css",
            ]
        ),
        [
            WorkingPathStatus::Tracked,
            WorkingPathStatus::Ignored,
            WorkingPathStatus::Tracked,
            WorkingPathStatus::Untracked,
            WorkingPathStatus::Ignored,
        ]
    );
}

fn path(value: &str) -> RepoPath {
    RepoPath::parse(value).unwrap()
}

fn statuses(fixture: &Fixture, paths: &[&str]) -> Vec<WorkingPathStatus> {
    let paths: Vec<_> = paths.iter().map(|value| path(value)).collect();
    fixture.repository().working_path_statuses(&paths).unwrap()
}
