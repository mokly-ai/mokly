//! A base tree with an attached extraction serves every read without Git.

use std::fs;
use std::path::Path;
use std::sync::Arc;

use mokly_compare::cache_types::Lease;
use mokly_compare::extraction_snapshots::{ProcessSnapshots, Snapshots};
use mokly_compare::git_tree::GitTree;
use mokly_compare::sources::{GitSources, Sources};
use mokly_git::disk::SystemDisk;
use mokly_git::repository::{GitRepositories, Repositories};
use mokly_git::tree::Limits;
use mokly_source_interface::tree::{FileKind, SourceTree};
use unimock::Unimock;

#[expect(dead_code, reason = "these cases need only the fixture repository")]
mod engine_support;
use engine_support::{Fixture, runner};

const FILES: [&str; 3] = ["specs/a.html", "styles/b.css", "images/c.svg"];

#[test]
fn an_attached_extraction_serves_reads_digests_and_projections_without_git() {
    let fixture = Fixture::new(&[
        (".gitattributes", "* text=auto eol=crlf\n"),
        ("specs/a.html", "<p>a</p>\n"),
        ("styles/b.css", "p {\n  color: red;\n}\n"),
        ("images/c.svg", "<svg/>\n"),
    ]);
    let root = fixture.directory.path();
    let repositories: &dyn Repositories = &GitRepositories {
        runner: runner(),
        disk: Arc::new(SystemDisk),
    };
    let repository = repositories.open(root).unwrap();
    let plain = GitTree::new(
        root.into(),
        Arc::new(GitSources::new(
            repository.clone(),
            fixture.commit.clone(),
            Limits::default(),
        )),
        1024 * 1024,
    );
    let bytes: Vec<_> = FILES
        .iter()
        .map(|path| plain.read(&root.join(path)).unwrap())
        .collect();
    assert!(bytes.iter().all(|bytes| bytes.ends_with(b"\r\n")));
    let digest = plain.digest(&root.join("images/c.svg")).unwrap();

    let temporary = tempfile::tempdir().unwrap();
    let target = temporary.path().join("sources");
    repository
        .extract(&fixture.commit, &target, Limits::default())
        .unwrap();
    let sources = Arc::new(GitSources::new(
        repository,
        fixture.commit.clone(),
        Limits::default(),
    ));
    let lease = Lease {
        directory: target,
        guard: Box::new(Unimock::new(())),
    };
    Sources::attach(sources.as_ref(), Arc::new(lease)).unwrap();
    let tree = GitTree::new(root.into(), sources, 1024 * 1024);
    fs::rename(root.join(".git"), root.join("hidden-git")).unwrap();

    for (path, expected) in FILES.iter().zip(&bytes) {
        assert_eq!(&tree.read(&root.join(path)).unwrap(), expected, "{path}");
    }
    assert_eq!(
        tree.digest_unretained(&root.join("images/c.svg")).unwrap(),
        digest
    );
    assert!(
        tree.project(&root.join("specs/missing.html"))
            .unwrap()
            .is_none()
    );
    let children = tree.children(&root.join("specs")).unwrap();
    assert_eq!(children.len(), 1);
    assert_eq!(children[0].kind, FileKind::File);
    assert!(Path::new(&root.join("hidden-git")).exists());
}

#[test]
fn an_extraction_file_that_base_code_changes_reads_its_pinned_bytes() {
    let fixture = Fixture::new(&[
        (".gitattributes", "* text=auto eol=crlf\n"),
        ("tokens.txt", "red\n"),
    ]);
    let root = fixture.directory.path();
    let repositories: &dyn Repositories = &GitRepositories {
        runner: runner(),
        disk: Arc::new(SystemDisk),
    };
    let repository = repositories.open(root).unwrap();
    let temporary = tempfile::tempdir().unwrap();
    let target = temporary.path().join("sources");
    repository
        .extract(&fixture.commit, &target, Limits::default())
        .unwrap();
    let snapshots: Arc<dyn Snapshots> = Arc::new(ProcessSnapshots::default());
    let attach = || {
        let sources = Arc::new(GitSources::sharing(
            repository.clone(),
            fixture.commit.clone(),
            Limits::default(),
            snapshots.clone(),
        ));
        let lease = Lease {
            directory: target.clone(),
            guard: Box::new(Unimock::new(())),
        };
        Sources::attach(sources.as_ref(), Arc::new(lease)).unwrap();
        GitTree::new(root.into(), sources, 1024 * 1024)
    };
    let first = attach();
    fs::write(target.join("tokens.txt"), "blue\n").unwrap();
    let tokens = root.join("tokens.txt");
    assert_eq!(first.read(&tokens).unwrap(), b"red\r\n");
    let second = attach();
    assert_eq!(second.read(&tokens).unwrap(), b"red\r\n");
    assert_eq!(
        second.digest_unretained(&tokens).unwrap(),
        mokly_model::material::digest(b"red\r\n")
    );
}
