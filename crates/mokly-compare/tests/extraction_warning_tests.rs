//! Failed historical filters keep independent files without caching partial sources.

#![cfg(unix)]

use std::fs;
use std::sync::Arc;

use mokly_compare::extraction::{CachedExtraction, Extraction};
use mokly_git::disk::SystemDisk;
use mokly_git::identity::ObjectId;
use mokly_git::repository::{GitRepositories, Repositories};

#[expect(dead_code, reason = "this case uses the native runner only")]
mod engine_support;
#[expect(dead_code, reason = "this case needs cache and Git fixtures only")]
mod support;

#[test]
fn partial_extraction_warns_and_a_new_generation_can_recover() {
    let temporary = tempfile::tempdir().unwrap();
    let root = temporary.path().join("repo");
    fs::create_dir(&root).unwrap();
    support::git(&root, &["init", "-b", "main"]);
    support::git(&root, &["config", "user.name", "Mokly Tests"]);
    support::git(&root, &["config", "user.email", "tests@mokly.invalid"]);
    fs::write(root.join(".gitattributes"), b"bad.txt filter=bad\n").unwrap();
    fs::write(root.join("bad.txt"), b"recoverable").unwrap();
    fs::write(root.join("good.txt"), b"independent").unwrap();
    support::git(&root, &["add", "."]);
    support::git(&root, &["commit", "-m", "fixture"]);
    let commit = ObjectId::parse(
        String::from_utf8_lossy(&support::git(&root, &["rev-parse", "HEAD"])).trim(),
    )
    .unwrap();
    support::git(&root, &["config", "filter.bad.smudge", "sh -c 'exit 42'"]);
    support::git(&root, &["config", "filter.bad.required", "true"]);
    let factory: &dyn Repositories = &GitRepositories {
        runner: engine_support::runner(),
        disk: Arc::new(SystemDisk),
    };
    let repository = factory.open(&root).unwrap();
    let cache = Arc::new(support::cache(temporary.path().join("cache"), 10000));
    let extraction: &dyn Extraction = &CachedExtraction {
        repository: repository.clone(),
        cache: cache.clone(),
        files: 100,
    };
    let partial;
    {
        let lease = extraction.acquire(&commit).unwrap();
        partial = lease.directory.clone();
        assert_eq!(
            fs::read(lease.directory.join("good.txt")).unwrap(),
            b"independent"
        );
        assert!(!lease.directory.join("bad.txt").exists());
        assert!(
            !lease
                .directory
                .parent()
                .unwrap()
                .join("receipt.json")
                .exists()
        );
        assert_eq!(repository.conversion_warnings().len(), 1);
    }
    assert!(!partial.exists());
    support::git(&root, &["config", "filter.bad.smudge", "cat"]);
    let repository = factory.open(&root).unwrap();
    let extraction: &dyn Extraction = &CachedExtraction {
        repository: repository.clone(),
        cache,
        files: 100,
    };
    let recovered = extraction.acquire(&commit).unwrap();
    assert_eq!(
        fs::read(recovered.directory.join("bad.txt")).unwrap(),
        b"recoverable"
    );
    assert!(repository.conversion_warnings().is_empty());
}
