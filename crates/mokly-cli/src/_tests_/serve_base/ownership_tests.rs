//! Old readers keep only their own base and late release cannot clear a newer slot.

use std::sync::Arc;

use mokly_compare::base_freshness::FreshnessMock;
use mokly_compare::base_render::BaseProvider;
use mokly_compare::base_retention::BaseRetentionRequest;
use mokly_compare::comparison_types::ComparisonMock;
use unimock::{MockFn, Unimock, matching};

use crate::warning_support::config;

use super::flow_support::{classify, result};
use super::support::{Fixture, base, head, inputs, runtime, selected};

#[test]
fn last_slot_owner_drops_newer_entry_while_old_reader_keeps_only_its_base() {
    let old = {
        let (reader, old, newer, slot) = {
            let first = Fixture::new(
                Arc::default(),
                Arc::new(Unimock::new(
                    FreshnessMock::current
                        .some_call(matching!(_))
                        .returns(Ok(true)),
                )),
                Arc::new(Unimock::new(())),
                runtime(),
            );
            let config = config();
            let selected = selected("a");
            let head = head(false);
            let request = BaseRetentionRequest {
                selected: &selected,
                working_config: &config,
                head: head.as_ref(),
                install_scripts: false,
            };
            let old = {
                let base = base(Some(inputs(false)));
                let weak = Arc::downgrade(&base);
                first.provider.keep(&request, base).unwrap();
                weak
            };
            let classified = classify(
                first.provider.clone(),
                selected.clone(),
                Arc::new(Unimock::new(())),
                Arc::new(Unimock::new(
                    ComparisonMock::compare_prepared
                        .some_call(matching!(_))
                        .answers(&|_, request, before, after| Ok(result(request, before, after))),
                )),
                head.clone(),
                &config,
            )
            .unwrap();
            let newer = {
                let base = base(Some(inputs(false)));
                let weak = Arc::downgrade(&base);
                first.provider.keep(&request, base).unwrap();
                weak
            };
            first.provider.release(&old.upgrade().unwrap());
            assert!(Arc::ptr_eq(
                &first.slot.lock().unwrap().as_ref().unwrap().base,
                &newer.upgrade().unwrap(),
            ));
            (classified.before, old, newer, Arc::downgrade(&first.slot))
        };
        assert!(slot.upgrade().is_none());
        assert!(newer.upgrade().is_none());
        assert!(old.upgrade().is_some());
        let _reader = reader;
        old
    };
    assert!(old.upgrade().is_none());
}
