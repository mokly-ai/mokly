//! Each freshness check of a kept base starts from the base listing of its last check.

use std::sync::{Arc, Mutex};

use mokly_compare::base_freshness::{Freshness, FreshnessChecks};
use mokly_compare::base_render::BaseProvider;
use mokly_compare::base_retention::BaseRetentionRequest;
use mokly_compare::working_inputs::SystemWorkingInputs;
use mokly_git::repository::RepositoryMock;
use mokly_git::source_key::CheckoutIdentity;
use unimock::{MockFn, Unimock, matching};

use crate::warning_support::config;

use super::support::{Fixture, base, head, inputs, runtime, selected};

#[test]
fn each_check_of_a_kept_base_sees_the_listing_of_its_last_check() {
    let seen = Arc::new(Mutex::new(Vec::new()));
    let mut pinned = selected("a");
    pinned.repository = Arc::new(Unimock::new(
        RepositoryMock::checkout_identity_kept
            .each_call(matching!(_))
            .answers_arc({
                let seen = seen.clone();
                Arc::new(move |_, commit, kept| {
                    seen.lock().unwrap().push(kept.matches(commit, b"listing"));
                    kept.keep(commit, b"listing");
                    Ok(Some(CheckoutIdentity {
                        digest: "before".into(),
                        filtered: false,
                    }))
                })
            }),
    ));
    let freshness: Arc<dyn Freshness> = Arc::new(FreshnessChecks {
        working: Arc::new(SystemWorkingInputs),
        installs: Arc::new(Unimock::new(())),
    });
    let fixture = Fixture::new(
        Arc::default(),
        freshness,
        Arc::new(Unimock::new(())),
        runtime(),
    );
    let config = config();
    let head = head(true);
    let request = BaseRetentionRequest {
        selected: &pinned,
        working_config: &config,
        head: head.as_ref(),
        install_scripts: false,
    };
    fixture
        .provider
        .keep(&request, base(Some(inputs(true))))
        .unwrap();
    for check in 0..3 {
        let found = fixture.provider.find_kept(&request).unwrap();
        assert!(found.is_some(), "{check}");
    }
    assert_eq!(*seen.lock().unwrap(), [false, true, true]);
}
