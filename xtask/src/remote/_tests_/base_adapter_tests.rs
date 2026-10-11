//! Real Git ancestor selection, main containment and deterministic tie-breaks.

use crate::remote::contracts::Git;
use crate::remote::git_adapter_support::Repository;
use crate::remote::git_identity::{BaseCommit, BaseLookup, CommitSha};

/// Read the typed base and verify both identity and ahead count.
fn require_base(repository: &Repository, sha: CommitSha, ahead: u64) {
    assert_eq!(
        repository.scripts.base(&repository.head()).unwrap(),
        BaseLookup::Found(BaseCommit { sha, ahead })
    );
}

/// A published checkout needs no ancestor offset.
#[test]
fn pushed_head_is_the_base_with_zero_ahead() {
    let repository = Repository::new();
    repository.push("feature");
    require_base(&repository, repository.head(), 0);
}

/// Unpushed descendants use their most recent pushed branch tip.
#[test]
fn unpushed_commits_use_the_pushed_branch_tip() {
    let repository = Repository::new();
    repository.push("feature");
    let base = repository.head();
    repository.commit("f1");
    repository.commit("f2");
    require_base(&repository, base, 2);
}

/// The main merge base wins over the closer old feature tip after a local merge.
#[test]
fn an_unpushed_main_merge_preserves_the_main_comparison_base() {
    let repository = Repository::new();
    repository.git(&["switch", "-c", "main"]);
    let main = repository.commit("m2");
    repository.push("main");
    repository.git(&["switch", "feature"]);
    for file in ["f1", "f2", "f3"] {
        repository.commit(file);
    }
    let old_tip = repository.head();
    repository.push("feature");
    repository.git(&["merge", "--no-edit", "main"]);
    assert_eq!(
        repository
            .git(&["rev-list", "--count", &format!("{old_tip}..HEAD")])
            .trim(),
        "2"
    );
    require_base(&repository, main.clone(), 4);
    assert_eq!(
        repository
            .git(&["merge-base", "HEAD", "origin/main"])
            .trim(),
        main.as_str()
    );
    assert_eq!(
        repository
            .git(&["merge-base", main.as_str(), "origin/main"])
            .trim(),
        main.as_str()
    );
}

/// A rebase excludes the old pushed tip and keeps the new main history.
#[test]
fn rebase_onto_newer_main_uses_main_while_origin_keeps_the_old_tip() {
    let repository = Repository::new();
    repository.git(&["branch", "main"]);
    for file in ["f1", "f2", "f3"] {
        repository.commit(file);
    }
    let old_tip = repository.head();
    repository.push("feature");
    repository.git(&["switch", "main"]);
    repository.commit("m2");
    let main = repository.commit("m3");
    repository.push("main");
    repository.git(&["rebase", "main", "feature"]);
    assert_eq!(
        repository.git(&["rev-parse", "origin/feature"]).trim(),
        old_tip.as_str()
    );
    require_base(&repository, main, 3);
}

/// A stack can select its published parent branch rather than main.
#[test]
fn stacked_branch_uses_another_pushed_branch() {
    let repository = Repository::new();
    repository.push("feature:main");
    repository.commit("f1");
    let parent = repository.commit("f2");
    repository.push("feature");
    repository.git(&["switch", "-c", "stacked"]);
    repository.commit("s1");
    require_base(&repository, parent, 1);
}

/// Missing and unrelated origin histories produce the explicit no-base variant.
#[test]
fn no_shared_origin_history_returns_no_base() {
    let repository = Repository::new();
    assert_eq!(
        repository.scripts.base(&repository.head()).unwrap(),
        BaseLookup::NoBase
    );
    let feature = repository.head();
    repository.git(&["switch", "--orphan", "unrelated"]);
    repository.commit("u1");
    repository.push("unrelated");
    repository.git(&["switch", "--detach", feature.as_str()]);
    assert_eq!(
        repository.scripts.base(&repository.head()).unwrap(),
        BaseLookup::NoBase
    );
}

/// Symbolic origin HEAD adds neither a duplicate candidate nor a merge-base call.
#[test]
fn origin_head_symbolic_ref_is_excluded() {
    let repository = Repository::new();
    repository.push("feature");
    repository.git(&[
        "symbolic-ref",
        "refs/remotes/origin/HEAD",
        "refs/remotes/origin/feature",
    ]);
    let head = repository.head();
    repository.clear_requests();
    require_base(&repository, head, 0);
    let requests = repository.process.requests.lock().unwrap();
    assert!(!requests.iter().any(|request| {
        request
            .args
            .iter()
            .any(|arg| arg == "refs/remotes/origin/HEAD")
    }));
    assert_eq!(
        requests
            .iter()
            .filter(
                |request| request.args.first().is_some_and(|arg| arg == "merge-base")
                    && request
                        .args
                        .get(1)
                        .is_some_and(|arg| arg != "--independent")
            )
            .count(),
        1
    );
}

/// Independent pushed candidates first compare counts, then their SHA bytes.
#[test]
fn independent_candidates_use_count_then_sha_order() {
    for unequal in [false, true] {
        let repository = Repository::new();
        repository.git(&["branch", "other"]);
        let first = repository.commit("f1");
        repository.push("feature");
        repository.git(&["switch", "other"]);
        let second = repository.commit("s1");
        repository.push("other");
        let mut expected = first.clone().min(second.clone());
        if unequal {
            repository.commit("s2");
            expected = repository.commit("s3");
            repository.push("other");
        }
        repository.git(&["switch", "feature"]);
        repository.git(&["merge", "--no-edit", "other"]);
        require_base(&repository, expected, 2);
    }
}
