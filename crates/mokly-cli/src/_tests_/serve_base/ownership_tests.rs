//! Old readers keep only their own base and late release cannot clear a newer slot.

use std::sync::Arc;

use mokly_compare::base_freshness::FreshnessMock;
use mokly_compare::base_render::BaseProvider;
use mokly_compare::base_retention::BaseRetentionRequest;
use mokly_compare::comparison_types::ComparisonMock;
use mokly_model::public_metadata::ChangesStatus;
use mokly_server::changes::{ChangeProgress, ChangeProgressMock};
use unimock::{MockFn, Unimock, matching};

use crate::base_render_admission::ImmediateBaseRenders;
use crate::changes_base::NativeBase;
use crate::serve_changes_base::{AttemptBase, PreparingDependencies};
use crate::warning_support::config;

use super::flow_support::{classify, result};
use super::support::{Fixture, base, head, inputs, runtime, selected};

#[test]
fn last_slot_owner_drops_newer_entry_while_old_reader_keeps_only_its_base() {
    let old = {
        let (reader, old, newer, slot, progress) = {
            let mut first = Fixture::new(
                Arc::default(),
                Arc::new(Unimock::new(
                    FreshnessMock::current
                        .some_call(matching!(_))
                        .returns(Ok(true)),
                )),
                Arc::new(Unimock::new(())),
                runtime(),
            );
            let progress = {
                let progress = Arc::new(Unimock::new(
                    ChangeProgressMock::status
                        .each_call(matching!(_))
                        .answers_arc({
                            let slot = first.slot.clone();
                            Arc::new(move |_, _| Ok(slot.lock().unwrap().is_some()))
                        }),
                ));
                let runtime = first.provider.runtime.clone();
                Arc::get_mut(&mut first.provider).unwrap().inner = Arc::new(AttemptBase {
                    warnings: Arc::default(),
                    progress: progress.clone(),
                    inner: Arc::new(NativeBase {
                        admission: Arc::new(ImmediateBaseRenders),
                        runtime,
                        cancellation: first.lifetime.clone(),
                        freshness: None,
                        dependencies: Arc::new(PreparingDependencies {
                            inner: Arc::new(Unimock::new(())),
                            progress: progress.clone(),
                        }),
                    }),
                });
                Arc::downgrade(&progress)
            };
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
            progress
                .upgrade()
                .unwrap()
                .status(ChangesStatus::Pending)
                .unwrap();
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
            (
                classified.before,
                old,
                newer,
                Arc::downgrade(&first.slot),
                progress,
            )
        };
        assert!(progress.upgrade().is_none());
        assert!(slot.upgrade().is_none());
        assert!(newer.upgrade().is_none());
        assert!(old.upgrade().is_some());
        let _reader = reader;
        old
    };
    assert!(old.upgrade().is_none());
}
