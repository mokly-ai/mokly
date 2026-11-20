//! Same-repository, foreign and missing provider identities share one rule.

use crate::pull_request::PullRequestRepositories;

#[test]
fn only_both_known_bound_repositories_are_not_a_fork() {
    for (head, base, fork) in [
        (Some(100), Some(100), false),
        (Some(200), Some(100), true),
        (None, Some(100), true),
        (Some(100), Some(200), true),
        (Some(100), None, true),
        (None, None, true),
    ] {
        assert_eq!(
            PullRequestRepositories {
                bound: 100,
                head,
                base
            }
            .is_fork(),
            fork
        );
    }
}
