//! Exact pure condition ordering.

use crate::remote::policy::{Check, ordered_checks};

#[test]
fn explicit_remote_conditions_follow_the_contract_order() {
    assert_eq!(
        ordered_checks(),
        [
            Check::GithubActions,
            Check::Program("blacksmith"),
            Check::Program("rsync"),
            Check::Program("ssh"),
            Check::Version,
            Check::Login,
            Check::Access,
            Check::Published,
            Check::Interrupt,
        ]
    );
}
