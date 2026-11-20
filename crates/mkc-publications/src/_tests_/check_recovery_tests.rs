//! Operator recovery uses only the transactional store and injected time.

use mkc_store_interface::build_check::BuildChecksMock;
use mkc_store_interface::publication_event::PublicationEventsMock;
use std::sync::Arc;
use unimock::{MockFn, Unimock, matching};

use crate::check_recovery::{CheckRecovery, PublicationCheckRecovery};

use super::support::{PUBLICATION, clock, now, transactions};

#[test]
fn alert_count_needs_only_the_query_boundary() {
    let recovery: &dyn CheckRecovery = &PublicationCheckRecovery {
        runtime: Arc::new(Unimock::new(())),
        transactions: transactions(Unimock::new((
            PublicationEventsMock::dead_letter_count
                .next_call(matching!())
                .returns(Ok(3)),
            BuildChecksMock::build_check_dead_letter_count
                .next_call(matching!())
                .returns(Ok(2)),
        ))),
    };
    assert_eq!(recovery.dead_letters().unwrap(), 5);
}

#[test]
fn recovery_preserves_event_identity_and_reports_noop_without_provider_access() {
    for changed in [true, false] {
        let recovery: &dyn CheckRecovery = &PublicationCheckRecovery {
            runtime: clock(),
            transactions: transactions(Unimock::new(
                PublicationEventsMock::requeue_publication_event
                    .next_call(matching!((id, at) if *id == PUBLICATION.0 && *at == now()))
                    .returns(Ok(changed)),
            )),
        };
        assert_eq!(recovery.requeue(PUBLICATION.0).unwrap(), changed);
    }
}
