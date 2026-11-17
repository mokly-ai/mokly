//! A subscription appearing after cancellation preflight remains retryable.

use std::sync::Arc;

use chrono::Duration;
use mkc_auth::runtime::{Runtime, RuntimeMock};
use mkc_billing::entitlements::Entitlements;
use mkc_billing::lifecycle::{BillingLifecycle, BillingLifecycleMock, Cancellation};
use mkc_domain::values::Role;
use mkc_email_interface::mail::Mailer;
use mkc_store_interface::billing_state::SubscriptionStatus;
use mkc_store_interface::billing_subscription::{BillingSubscription, BillingSubscriptionsMock};
use mkc_store_interface::member::MembersMock;
use mkc_store_interface::organization::OrganizationsMock;
use mkc_store_interface::store::{Decision, Store, StoreMock, Transaction};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::action::Action;
use crate::builds::service::BuildsConfiguredMock;
use crate::input::Delete;
use crate::pagination::Pagination;
use crate::platform::error::Error;
use crate::platform::service::{Platform, PlatformService};

use super::support::{USER, WORKSPACE, member, now, workspace};

#[test]
fn subscription_appearing_after_preflight_returns_unavailable() {
    let preflight_workspace = workspace();
    let final_workspace = preflight_workspace.clone();
    let owner = member(Role::Owner);
    let preflight_owner = owner.clone();
    let final_owner = owner;
    let store: Arc<dyn Store> = Arc::new(Unimock::new((
        StoreMock::read
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                let mut queries = Unimock::new((
                    MembersMock::members
                        .next_call(matching!(_))
                        .returns(Ok(vec![preflight_owner.clone()])),
                    OrganizationsMock::organization
                        .next_call(matching!(_))
                        .returns(Ok(Some(preflight_workspace.clone()))),
                ));
                assert_eq!(work.run(&mut queries).unwrap(), Decision::Commit);
                Ok(())
            })),
        StoreMock::transaction
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                let workspace = final_workspace.clone();
                let mut queries = Unimock::new((
                    MembersMock::members
                        .next_call(matching!(_))
                        .returns(Ok(vec![final_owner.clone()])),
                    OrganizationsMock::organization
                        .each_call(matching!(_))
                        .answers_arc(Arc::new(move |_, _| Ok(Some(workspace.clone()))))
                        .n_times(2),
                    BillingSubscriptionsMock::billing_subscription
                        .next_call(matching!(_))
                        .returns(Ok(Some(live_subscription()))),
                ));
                assert_eq!(work.run(&mut queries).unwrap(), Decision::Rollback);
                Ok(())
            })),
    )));
    let runtime: Arc<dyn Runtime> = Arc::new(Unimock::new((
        RuntimeMock::id
            .each_call(matching!())
            .returns(Uuid::from_u128(10))
            .n_times(4),
        RuntimeMock::now
            .each_call(matching!())
            .returns(now())
            .n_times(2),
    )));
    let billing: Arc<dyn BillingLifecycle> = Arc::new(Unimock::new(
        BillingLifecycleMock::cancel_for_deletion
            .next_call(matching!(_))
            .returns(Ok(Cancellation {
                provider_subscription_id: None,
            })),
    ));
    let mailer: Arc<dyn Mailer> = Arc::new(Unimock::new(()));
    let entitlements: Arc<dyn Entitlements> = Arc::new(Unimock::new(()));
    let service = PlatformService {
        builds: Arc::new(Unimock::new(
            BuildsConfiguredMock.each_call(matching!()).returns(false),
        )),
        store,
        runtime,
        mailer,
        entitlements,
        billing,
        app_origin: "https://app.example.com".into(),
        preview_workspace: None,
    };
    let result = service.execute(
        Some(USER),
        Action::DeleteWorkspace(
            WORKSPACE,
            Delete {
                confirmation_name: "Team".into(),
                version: 1,
            },
        ),
        Pagination {
            cursor: None,
            limit: 50,
        },
    );
    assert!(matches!(result, Err(Error::Unavailable)));
}

fn live_subscription() -> BillingSubscription {
    BillingSubscription {
        organization_id: WORKSPACE,
        provider_subscription_id: "sub_raced".into(),
        status: SubscriptionStatus::Active,
        current_period_end: Some(now() + Duration::days(30)),
        trial_end: None,
        cancel_at_period_end: false,
        payment_failed_at: None,
        payment_updated_at: None,
        updated_at: now(),
        seats_checked_at: None,
        version: 1,
    }
}
