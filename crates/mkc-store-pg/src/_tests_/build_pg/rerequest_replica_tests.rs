//! Re-run replicas must skip another claim's parents before taking check locks.

use std::thread;

use super::rerequest_support::{consume, mark};
use super::support::{fixture, rc};

#[test]
fn two_replicas_share_parent_claims_for_both_check_owners() {
    for first_prefix in ["mokly-build:", "mokly-publication:"] {
        for second_prefix in ["mokly-build:", "mokly-publication:"] {
            let Some(f) = fixture() else { return };
            let (first_mark, first_build) = mark(&f, first_prefix, 1);
            let (second_mark, second_build) = mark(&f, second_prefix, 2);
            let mut first = f.connection();
            let mut second = f.connection();
            let mut observer = f.connection();
            let count = rc(&mut first, |q| {
                let marks = q.rerequested_github_checks(first_prefix, 1).unwrap();
                assert_eq!(marks.len(), 1);
                assert_eq!(marks[0].id, first_mark.id);
                let count = thread::spawn(move || {
                    rc(&mut second, |q| {
                        q.rerequested_github_checks(second_prefix, 100)
                            .unwrap()
                            .len()
                    })
                })
                .join()
                .unwrap();
                consume(q, &marks[0], &first_build, f.now).unwrap();
                count
            });
            assert_eq!(count, 0, "the second replica must skip the busy parent");
            rc(&mut observer, |q| {
                let marks = q.rerequested_github_checks(second_prefix, 100).unwrap();
                assert_eq!(marks.len(), 1);
                assert_eq!(marks[0].id, second_mark.id);
                consume(q, &marks[0], &second_build, f.now).unwrap();
                assert!(
                    !q.github_check(first_mark.github_id)
                        .unwrap()
                        .unwrap()
                        .rerequested
                );
                assert!(
                    !q.github_check(second_mark.github_id)
                        .unwrap()
                        .unwrap()
                        .rerequested
                );
                assert!(
                    q.rerequested_github_checks(first_prefix, 100)
                        .unwrap()
                        .is_empty()
                );
                assert!(
                    q.rerequested_github_checks(second_prefix, 100)
                        .unwrap()
                        .is_empty()
                );
            });
        }
    }
}
