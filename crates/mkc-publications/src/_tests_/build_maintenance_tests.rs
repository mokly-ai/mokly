//! Build prune cutoff, cap and database-only dead-letter recovery.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use mkc_store_interface::build::BuildsMock;
use mkc_store_interface::build_check::BuildChecksMock;
use unimock::{MockFn, Unimock, matching};

use crate::build_maintenance::{BuildMaintenance, DatabaseBuildMaintenance};
use crate::tests::build_fixtures::*;

#[test]
fn prune_uses_inclusive_thirty_day_cutoff_and_one_thousand_limit() {
    let service: &dyn BuildMaintenance = &DatabaseBuildMaintenance {
        runtime: clock_runtime(),
        transactions: transactions(Unimock::new(
            BuildsMock::prune_builds
                .some_call(matching!(_, 1000))
                .answers(&|_, cutoff, _| {
                    assert_eq!((now() - cutoff).num_days(), 30);
                    Ok(8)
                }),
        )),
    };
    assert_eq!(service.prune(2_592_000).unwrap(), 8);
}

#[test]
fn requeue_reports_changed_and_noop_without_loading_any_provider() {
    for changed in [true, false] {
        let service: &dyn BuildMaintenance = &DatabaseBuildMaintenance {
            runtime: clock_runtime(),
            transactions: transactions(Unimock::new(
                BuildChecksMock::requeue_build_check
                    .some_call(matching!(_, _))
                    .returns(Ok(changed)),
            )),
        };
        assert_eq!(service.requeue(BUILD).unwrap(), changed);
    }
}
