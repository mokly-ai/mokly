//! Invitation delivery uses committed rows and never runs inside a retry.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use mkc_email_interface::mail::{Content, Lifetime, MailerMock};
use mkc_auth::runtime::RuntimeMock;
use mkc_domain::values::Role;
use mkc_store_interface::store::{Decision, StoreMock, Transaction};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::action::Action;
use crate::builds::service::BuildsConfiguredMock;
use crate::input::Invite;
use crate::pagination::Pagination;
use crate::platform::error::Error;
use crate::platform::service::{Platform, PlatformService};

use super::query_fixture::queries;
use super::support::{USER, WORKSPACE, now};

fn action(email: &str) -> Action {
    Action::Invite(
        WORKSPACE,
        Invite {
            email: email.to_owned(),
            role: Role::Member,
        },
    )
}

fn runtime() -> Arc<Unimock> {
    Arc::new(Unimock::new((
        RuntimeMock::id
            .each_call(matching!())
            .returns(Uuid::from_u128(10)),
        RuntimeMock::now.each_call(matching!()).returns(now()),
    )))
}

fn page() -> Pagination {
    Pagination {
        cursor: None,
        limit: 50,
    }
}

#[test]
fn committed_invitation_sends_the_stored_names_after_commit() {
    let committed = Arc::new(AtomicBool::new(false));
    let marker = committed.clone();
    let store = Arc::new(Unimock::new(
        StoreMock::transaction
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                let invited = action("new@example.com");
                assert_eq!(
                    work.run(&mut queries(Some(Role::Owner), &invited)).unwrap(),
                    Decision::Commit
                );
                marker.store(true, Ordering::SeqCst);
                Ok(())
            })),
    ));
    let marker = committed.clone();
    let mailer = Arc::new(Unimock::new(
        MailerMock::send
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, message| {
                assert!(marker.load(Ordering::SeqCst));
                assert_eq!(message.recipient, "new@example.com");
                match &message.content {
                    Content::Invitation {
                        link,
                        organization,
                        invited_by,
                        valid_for,
                    } => {
                        assert!(link.starts_with("https://app.example.com/workspaces/"));
                        assert_eq!(organization, "Team");
                        assert_eq!(invited_by, "Person");
                        assert_eq!(*valid_for, Lifetime::Days(7));
                    }
                    Content::SignIn { .. } => panic!("expected invitation"),
                }
                Ok(())
            })),
    ));
    let service = PlatformService {
        builds: Arc::new(Unimock::new(
            BuildsConfiguredMock.each_call(matching!()).returns(false),
        )),
        store,
        runtime: runtime(),
        mailer,
        entitlements: Arc::new(Unimock::new(())),
        billing: Arc::new(Unimock::new(())),
        app_origin: "https://app.example.com".into(),
        preview_workspace: None,
    };
    assert_eq!(
        service
            .execute(Some(USER), action("new@example.com"), page())
            .unwrap()
            .status,
        201
    );
    assert!(committed.load(Ordering::SeqCst));
}

#[test]
fn rejected_invitation_rolls_back_without_sending() {
    let store = Arc::new(Unimock::new(
        StoreMock::transaction
            .next_call(matching!(_))
            .answers(&|_, work: &mut dyn Transaction| {
                let duplicate = action("target@example.com");
                assert_eq!(
                    work.run(&mut queries(Some(Role::Owner), &duplicate))
                        .unwrap(),
                    Decision::Rollback
                );
                Ok(())
            }),
    ));
    let service = PlatformService {
        builds: Arc::new(Unimock::new(
            BuildsConfiguredMock.each_call(matching!()).returns(false),
        )),
        store,
        runtime: runtime(),
        mailer: Arc::new(Unimock::new(())),
        entitlements: Arc::new(Unimock::new(())),
        billing: Arc::new(Unimock::new(())),
        app_origin: "https://app.example.com".into(),
        preview_workspace: None,
    };
    assert!(matches!(
        service.execute(Some(USER), action("target@example.com"), page()),
        Err(Error::AlreadyMember)
    ));
}
