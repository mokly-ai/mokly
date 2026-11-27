//! Bearer and cookie verification before a single current-access read.

use std::sync::Arc;

use mkc_store_interface::publication::PublicationsMock;
use unimock::{MockFn, Unimock, matching};

use crate::access::{CatalogueAccess, CatalogueAccessService};
use crate::capability::{CapabilitiesMock, Capability};
use crate::error::Error;
use crate::policy::AccessPolicyMock;
use crate::transaction::{QueryWork, TransactionsMock};

use super::super::support::{
    PROJECT, PUBLICATION, USER, clock, locations, now, project, publication,
};

fn service(signer: Unimock, policy: Unimock) -> CatalogueAccessService {
    let queries = Unimock::new(
        PublicationsMock::publication
            .some_call(matching!(&PUBLICATION))
            .returns(Ok(Some(publication()))),
    );
    let transactions = Unimock::new(
        TransactionsMock::run
            .some_call(matching!(true, _))
            .answers_arc(Arc::new(move |_, _, work: &mut QueryWork<'_>| {
                work(&mut queries.clone())
            }))
            .once(),
    );
    CatalogueAccessService {
        transactions: Arc::new(transactions),
        policy: Arc::new(policy),
        runtime: clock(),
        capabilities: Arc::new(signer),
        locations: locations(),
    }
}

fn valid_capability() -> Capability {
    Capability {
        publication: PUBLICATION,
        user: USER,
        expires: now().timestamp() + 300,
    }
}

fn member_policy() -> Unimock {
    Unimock::new(
        AccessPolicyMock::read
            .some_call(matching!(_, &PROJECT, Some(USER)))
            .returns(Ok(project())),
    )
}

#[test]
fn verified_bearer_decides_access_without_reading_or_clearing_the_cookie() {
    for denied in [false, true] {
        let policy = Unimock::new(
            AccessPolicyMock::read
                .some_call(matching!(_, &PROJECT, Some(USER)))
                .returns(if denied {
                    Err(Error::NotFound)
                } else {
                    Ok(project())
                }),
        );
        let service = service(
            Unimock::new(
                CapabilitiesMock::verify
                    .some_call(matching!("bearer"))
                    .returns(Ok(valid_capability())),
            ),
            policy,
        );
        let mut clear = true;
        let result = service.authorize(
            PUBLICATION,
            Some("bearer"),
            &mut || panic!("a verified bearer must leave the cookie unread"),
            &mut clear,
        );
        if denied {
            assert!(matches!(result, Err(Error::NotFound)), "denied: {result:?}");
        } else {
            let context = result.unwrap();
            assert_eq!(context.publication.id, PUBLICATION);
            assert_eq!(context.project.id, PROJECT);
        }
        assert!(!clear, "denied: {denied}");
    }
}

#[test]
fn invalid_bearer_falls_back_to_a_valid_cookie() {
    let service = service(
        Unimock::new((
            CapabilitiesMock::verify
                .next_call(matching!("bad-bearer"))
                .returns(Err(Error::Unauthorized)),
            CapabilitiesMock::verify
                .next_call(matching!("cookie"))
                .returns(Ok(valid_capability())),
        )),
        member_policy(),
    );
    let mut clear = false;
    service
        .authorize(
            PUBLICATION,
            Some("bad-bearer"),
            &mut || Some("cookie"),
            &mut clear,
        )
        .unwrap();
    assert!(!clear);
}

#[test]
fn invalid_bearer_without_a_cookie_checks_anonymous_access_in_one_transaction() {
    let service = service(
        Unimock::new(
            CapabilitiesMock::verify
                .some_call(matching!("bad-bearer"))
                .returns(Err(Error::Unauthorized)),
        ),
        Unimock::new(
            AccessPolicyMock::read
                .some_call(matching!(_, &PROJECT, None))
                .returns(Err(Error::Unauthorized)),
        ),
    );
    let mut clear = false;
    assert!(matches!(
        service.authorize(PUBLICATION, Some("bad-bearer"), &mut || None, &mut clear),
        Err(Error::Unauthorized)
    ));
    assert!(!clear);
}

#[test]
fn valid_cookie_authorizes_when_the_bearer_is_absent() {
    let service = service(
        Unimock::new(
            CapabilitiesMock::verify
                .some_call(matching!("cookie"))
                .returns(Ok(valid_capability())),
        ),
        member_policy(),
    );
    let mut clear = false;
    service
        .authorize(PUBLICATION, None, &mut || Some("cookie"), &mut clear)
        .unwrap();
    assert!(!clear);
}
