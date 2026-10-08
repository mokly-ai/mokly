//! Exact pure condition ordering.

use crate::executor::Executor;
use crate::remote::policy::{Check, ordered_checks};

#[test]
fn explicit_remote_conditions_follow_the_contract_order() {
    assert_eq!(
        ordered_checks(Executor::Remote),
        [
            Check::GithubActions,
            Check::Programs,
            Check::Version,
            Check::Login,
            Check::Access,
            Check::Base,
            Check::Interrupt,
        ]
    );
}

#[test]
fn auto_checks_the_key_before_programs() {
    let checks = ordered_checks(Executor::Auto);
    assert_eq!(checks[0], Check::GithubActions);
    assert_eq!(checks[1], Check::Key);
    assert_eq!(checks[2], Check::Programs);
    assert!(ordered_checks(Executor::Local).is_empty());
}
