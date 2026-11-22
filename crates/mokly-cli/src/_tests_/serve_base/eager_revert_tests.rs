//! Source-only observation of an edited key must preserve the kept base of a revert.

use std::sync::Arc;

use mokly_compare::base_freshness::FreshnessMock;
use mokly_compare::base_render::BaseProvider;
use mokly_compare::base_retention::BaseRetentionRequest;
use unimock::{MockFn, Unimock, matching};

use crate::serve_base::{KeptAvailability, KeptState, SlotAvailability};
use crate::serve_base_key::BaseKey;
use crate::warning_support::config;

use super::support::{Fixture, base, head, inputs, runtime, selected};

#[test]
fn eager_edit_then_revert_preserves_the_kept_base_until_classification() {
    let freshness = Unimock::new(
        FreshnessMock::current
            .some_call(matching!(_, _))
            .returns(Ok(true)),
    )
    .no_verify_in_drop();
    let fixture = Fixture::new(
        Arc::default(),
        Arc::new(freshness),
        Arc::new(Unimock::new(())),
        runtime(),
    );
    let config = config();
    let pinned = selected("a");
    let head = head(false);
    let request = BaseRetentionRequest {
        selected: &pinned,
        working_config: &config,
        head: head.as_ref(),
        install_scripts: false,
    };
    let kept = base(Some(inputs(false)));
    fixture.provider.keep(&request, kept.clone()).unwrap();
    let availability: &dyn KeptAvailability = &SlotAvailability {
        slot: Arc::downgrade(&fixture.slot),
    };
    let edited = availability.state(&BaseKey::selected(&selected("b"), &config, false).unwrap());
    let reverted = availability.state(&BaseKey::new(&request).unwrap());
    let reused = fixture
        .provider
        .find_kept(&request)
        .unwrap()
        .map(|reuse| Arc::ptr_eq(&reuse.base, &kept));
    assert_eq!(
        [edited, reverted],
        [KeptState::Different, KeptState::Matching]
    );
    assert_eq!(reused, Some(true));
}
