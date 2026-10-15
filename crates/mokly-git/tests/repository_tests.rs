//! Real branch histories, working-tree changes and exact base-source archives.

use std::fs;
#[cfg(unix)]
use std::os::unix::fs::{PermissionsExt, symlink};

use mokly_git::changes::{ChangedPath, Kind};
use mokly_git::error::Error;
use mokly_git::identity::RepoPath;
use mokly_git::tree::Limits;

use support::Fixture;

mod support;

#[test]
fn merge_base_uses_history_and_diff_includes_every_working_side() {
    let fixture = Fixture::new();
    for path in ["rename", "staged", "unstaged", "deleted"] {
        fixture.write(path, path.as_bytes());
    }
    fixture.write(".gitignore", b"ignored\n");
    let base = fixture.commit();
    fixture.git(&["branch", "base"]);
    fixture.write("main-only", b"base branch");
    fixture.commit();
    fixture.git(&["switch", "-c", "head", base.as_str()]);
    fixture.write("committed", b"new commit");
    fixture.commit();
    fixture.git(&["mv", "rename", "renamed"]);
    fixture.write("staged", b"staged edit");
    fixture.git(&["add", "staged"]);
    fixture.write("unstaged", b"unstaged edit");
    fs::remove_file(fixture.root().join("deleted")).unwrap();
    fixture.write("untracked", b"new");
    fixture.write("ignored", b"private");
    let repository = fixture.repository();
    assert_eq!(repository.merge_base("base").unwrap(), base);
    let changes = repository.changed_paths(&base).unwrap();
    assert_eq!(
        changes
            .iter()
            .map(|change| change.path.as_str())
            .collect::<Vec<_>>(),
        [
            "committed",
            "deleted",
            "renamed",
            "staged",
            "unstaged",
            "untracked"
        ]
    );
    assert_eq!(
        changes[2].kind,
        Kind::Renamed {
            from: ChangedPath::parse("rename").unwrap(),
            similarity: 100
        }
    );
    assert_eq!(changes[1].kind, Kind::Deleted);
    assert!(matches!(
        repository.merge_base("missing-ref"),
        Err(Error::CommandFailed { .. })
    ));
    assert!(matches!(
        repository.merge_base("--all"),
        Err(Error::CommandFailed { .. })
    ));
}

#[test]
fn blobs_and_extraction_read_exact_regular_files_from_the_commit() {
    let fixture = Fixture::new();
    fixture.write("specs/Binary [literal]file", &[0, 255, 10, 13]);
    fixture.write("specs/name.txt", b"$Format:%H$");
    fixture.write(
        ".gitattributes",
        b"specs/name.txt export-subst\nspecs/* export-ignore\n",
    );
    fixture.write("elsewhere/file", b"other root");
    let base = fixture.commit();
    fixture.write("specs/Binary [literal]file", b"head edit");
    let repository = fixture.repository();
    let entries = repository
        .list(
            &base,
            Some(&RepoPath::parse("specs").unwrap()),
            Limits::default(),
        )
        .unwrap();
    assert_eq!(entries.len(), 2);
    assert_eq!(
        repository.read(&base, &entries[0].path, 4).unwrap(),
        [0, 255, 10, 13]
    );
    assert!(matches!(
        repository.read(&base, &entries[0].path, 3),
        Err(Error::ByteLimit { limit: 3 })
    ));
    assert!(matches!(
        repository.list(
            &base,
            None,
            Limits {
                files: 1,
                ..Limits::default()
            }
        ),
        Err(Error::FileCount { .. })
    ));
    assert!(matches!(
        repository.read(&base, &RepoPath::parse("missing").unwrap(), 100),
        Err(Error::MissingBlob { .. })
    ));
    let destination = tempfile::tempdir().unwrap();
    let extracted = destination.path().join("base");
    repository
        .extract(&base, &extracted, Limits::default())
        .unwrap();
    assert_eq!(
        fs::read(extracted.join("specs/name.txt")).unwrap(),
        b"$Format:%H$"
    );
    assert_eq!(
        fs::read(extracted.join("specs/Binary [literal]file")).unwrap(),
        [0, 255, 10, 13]
    );
    assert!(!extracted.join(".git").exists());
    assert!(
        repository
            .extract(&base, &extracted, Limits::default())
            .is_err()
    );
    assert!(matches!(
        repository.extract(
            &base,
            &destination.path().join("oversized"),
            Limits {
                bytes: 1,
                ..Limits::default()
            }
        ),
        Err(Error::ByteLimit { .. })
    ));
    assert!(!destination.path().join("oversized").exists());
}

#[cfg(unix)]
#[test]
fn source_reads_deny_symlinks_and_extraction_preserves_executable_mode() {
    let fixture = Fixture::new();
    fixture.write("file", b"base");
    fs::set_permissions(
        fixture.root().join("file"),
        fs::Permissions::from_mode(0o755),
    )
    .unwrap();
    symlink("file", fixture.root().join("link")).unwrap();
    let base = fixture.commit();
    let repository = fixture.repository();
    assert!(matches!(
        repository.read(&base, &RepoPath::parse("link").unwrap(), 100),
        Err(Error::NotRegular { .. })
    ));
    let directory = tempfile::tempdir().unwrap();
    let target = directory.path().join("base");
    repository
        .extract(&base, &target, Limits::default())
        .unwrap();
    assert!(!target.join("link").exists());
    assert_ne!(
        fs::metadata(target.join("file"))
            .unwrap()
            .permissions()
            .mode()
            & 0o111,
        0
    );
}

#[test]
fn unrelated_histories_keep_a_typed_no_merge_base_error() {
    let fixture = Fixture::new();
    fixture.write("main", b"main");
    fixture.commit();
    fixture.git(&["switch", "--orphan", "unrelated"]);
    fixture.write("other", b"other history");
    fixture.commit();
    fixture.git(&["switch", "main"]);
    assert!(matches!(
        fixture.repository().merge_base("unrelated"),
        Err(Error::NoMergeBase)
    ));
}

#[cfg(unix)]
#[test]
fn repository_root_validation_accepts_aliases_and_rejects_nested_roots() {
    let fixture = Fixture::new();
    fixture.write("nested/file", b"file");
    fixture.commit();
    let aliases = tempfile::tempdir().unwrap();
    let alias = aliases.path().join("repo");
    std::os::unix::fs::symlink(fixture.root(), &alias).unwrap();
    let factory: &dyn mokly_git::repository::Repositories =
        &mokly_git::repository::GitRepositories {
            runner: support::runner(std::sync::Arc::new(mokly_git::control::Token::default())),
            disk: std::sync::Arc::new(mokly_git::disk::SystemDisk),
        };
    assert!(factory.open(&alias).is_ok());
    assert!(matches!(
        factory.open(&fixture.root().join("nested")),
        Err(Error::RootMismatch { .. })
    ));
}
