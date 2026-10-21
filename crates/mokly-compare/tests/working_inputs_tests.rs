//! Git dependency candidates exclude ignored trees and use clean object identities.

use std::fs;
use std::sync::Arc;

use mokly_compare::inputs::{InputReader, SourceInputs};
use mokly_compare::sources::GitSources;
use mokly_compare::working_inputs::{SystemWorkingInputs, WorkingInputs};
use mokly_git::control::{SystemClock, Token};
use mokly_git::disk::SystemDisk;
use mokly_git::identity::ObjectId;
use mokly_git::repository::{GitRepositories, Repositories};
use mokly_git::system::SystemRunner;
use mokly_git::tree::Limits;
use mokly_platform::processes::SystemProcessGroups;

use support::git;

#[expect(
    dead_code,
    reason = "The shared host fixtures also support cache and install tests."
)]
mod support;

#[test]
fn ignored_packages_nested_clones_and_clean_crlf_do_not_change_dependency_identity() {
    let temporary = tempfile::tempdir().unwrap();
    let root = temporary.path().canonicalize().unwrap();
    git(&root, &["init", "-b", "main"]);
    git(&root, &["config", "user.name", "Mokly Tests"]);
    git(&root, &["config", "user.email", "tests@mokly.invalid"]);
    git(&root, &["config", "core.autocrlf", "true"]);
    fs::write(root.join(".gitignore"), b".next/\n").unwrap();
    fs::write(root.join("package.json"), b"{\n\"name\":\"base\"\n}\n").unwrap();
    fs::write(root.join("package-lock.json"), b"{}\n").unwrap();
    git(&root, &["add", "-A"]);
    git(&root, &["commit", "-m", "base"]);
    let commit =
        ObjectId::parse(String::from_utf8_lossy(&git(&root, &["rev-parse", "HEAD"])).trim())
            .unwrap();
    fs::write(
        root.join("package.json"),
        b"{\r\n\"name\":\"base\"\r\n}\r\n",
    )
    .unwrap();
    fs::create_dir(root.join(".next")).unwrap();
    fs::write(root.join(".next/package.json"), b"ignored").unwrap();
    let nested = root.join("nested");
    fs::create_dir(&nested).unwrap();
    git(&nested, &["init", "-b", "main"]);
    fs::write(nested.join("package.json"), b"nested clone").unwrap();
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink("missing", root.join(".next/link")).unwrap();
    }
    let factory: &dyn Repositories = &GitRepositories {
        runner: Arc::new(SystemRunner {
            groups: Arc::new(SystemProcessGroups),
            clock: Arc::new(SystemClock::default()),
            cancellation: Arc::new(Token::default()),
        }),
        disk: Arc::new(SystemDisk),
    };
    let repository = factory.open(&root).unwrap();
    let base = SourceInputs
        .read(
            &GitSources::new(repository.clone(), commit, Limits::default()),
            Limits::default(),
        )
        .unwrap();
    let head = SystemWorkingInputs
        .read(repository.as_ref(), &base, Limits::default())
        .unwrap();
    assert_eq!(head, base);
    assert_eq!(
        head.files[&mokly_git::identity::RepoPath::parse("package.json").unwrap()],
        b"{\r\n\"name\":\"base\"\r\n}\r\n"
    );
    assert_eq!(head.objects, base.objects);
    assert_eq!(head.files.len(), 2);
    fs::create_dir(root.join("frontend")).unwrap();
    fs::write(root.join("frontend/package.json"), b"{}").unwrap();
    let changed = SystemWorkingInputs
        .read(repository.as_ref(), &base, Limits::default())
        .unwrap();
    assert_ne!(changed, base);
    assert_eq!(changed.files.len(), 3);
}
