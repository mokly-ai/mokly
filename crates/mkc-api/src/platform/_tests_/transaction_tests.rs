//! Policy failures roll back without becoming query errors or retriable failures.

use std::sync::Arc;

use mkc_store_interface::store::{Decision, StoreMock, Transaction};
use unimock::{MockFn, Unimock, matching};

use crate::platform::error::Error;
use crate::platform::service::PlatformService;

#[test]
fn policy_rejection_requests_rollback_and_keeps_its_type() {
    let service = PlatformService {
        builds: Arc::new(Unimock::new(())),
        store: Arc::new(Unimock::new(
            StoreMock::transaction
                .next_call(matching!(_))
                .answers(&|_, work: &mut dyn Transaction| {
                    assert_eq!(work.run(&mut Unimock::new(())).unwrap(), Decision::Rollback);
                    Ok(())
                })
                .once(),
        )),
        runtime: Arc::new(Unimock::new(())),
        mailer: Arc::new(Unimock::new(())),
        entitlements: Arc::new(Unimock::new(())),
        billing: Arc::new(Unimock::new(())),
        app_origin: "https://app.example.com".into(),
        preview_workspace: None,
    };
    assert!(matches!(
        service.transact(false, &mut |_| Err(Error::LastOwner)),
        Err(Error::LastOwner)
    ));
}
