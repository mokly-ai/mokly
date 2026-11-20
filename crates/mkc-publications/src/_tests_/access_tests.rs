//! One-use grant issuance, expiry and current-membership authorization.

use std::sync::Arc;

use chrono::Duration;
use mkc_auth::runtime::{RuntimeMock, hash};
use mkc_domain::ids::PublicationId;
use mkc_domain::values::Visibility;
use mkc_store_interface::publication::{PublicationState, PublicationsMock};
use mkc_store_interface::publication_event::{CatalogueGrant, PublicationEventsMock};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::access::{CatalogueAccess, CatalogueAccessService};
use crate::capability::{CapabilitiesMock, Capability};
use crate::error::Error;
use crate::policy::AccessPolicyMock;

use super::support::{
    PROJECT, PUBLICATION, USER, clock, locations, now, project, publication, transactions,
};

fn service(queries: Unimock, policy: Unimock, signer: Unimock) -> CatalogueAccessService {
    CatalogueAccessService {
        transactions: transactions(queries),
        policy: Arc::new(policy),
        runtime: clock(),
        capabilities: Arc::new(signer),
        locations: locations(),
    }
}

#[test]
fn issued_grants_store_only_the_digest_and_bind_exact_user_host_and_deadline() {
    let queries = Unimock::new((
        PublicationsMock::publication
            .next_call(matching!(&PUBLICATION))
            .returns(Ok(Some(publication()))),
        PublicationEventsMock::insert_catalogue_grant
            .next_call(matching!(_))
            .answers(&|_, grant| {
                assert_eq!(grant.digest, hash(&"a".repeat(64)));
                assert_eq!(grant.publication_id, PUBLICATION);
                assert_eq!(grant.user_id, USER);
                assert_eq!(grant.expires_at, now() + Duration::seconds(60));
                Ok(())
            }),
    ));
    let service = CatalogueAccessService {
        transactions: transactions(queries),
        policy: Arc::new(Unimock::new(
            AccessPolicyMock::read
                .next_call(matching!(_, &PROJECT, Some(USER)))
                .returns(Ok(project())),
        )),
        capabilities: Arc::new(Unimock::new(())),
        locations: locations(),
        runtime: Arc::new(Unimock::new((
            RuntimeMock::now.next_call(matching!()).returns(now()),
            RuntimeMock::secret
                .next_call(matching!())
                .returns(Ok("a".repeat(64))),
        ))),
    };
    let grant = service.grant(USER, PROJECT, PUBLICATION).unwrap();
    assert_eq!(grant.grant, "a".repeat(64));
    assert_eq!(
        grant.exchange_url,
        format!("{}/_access", locations().catalogue(PUBLICATION))
    );
}

#[test]
fn exchange_consumes_once_and_signs_only_after_membership_recheck() {
    let grant = CatalogueGrant {
        digest: hash(&"a".repeat(64)),
        publication_id: PUBLICATION,
        user_id: USER,
        expires_at: now() + Duration::seconds(60),
    };
    let service = service(
        Unimock::new((
            PublicationsMock::publication
                .each_call(matching!(&PUBLICATION))
                .answers(&|_, _| Ok(Some(publication())))
                .n_times(2),
            PublicationEventsMock::consume_catalogue_grant
                .next_call(matching!(_, &PUBLICATION, _))
                .returns(Ok(Some(grant))),
            PublicationEventsMock::consume_catalogue_grant
                .next_call(matching!(_, &PUBLICATION, _))
                .returns(Ok(None)),
        )),
        Unimock::new(
            AccessPolicyMock::read
                .next_call(matching!(_, &PROJECT, Some(USER)))
                .returns(Ok(project())),
        ),
        Unimock::new(
            CapabilitiesMock::sign
                .next_call(matching!(_))
                .answers(&|_, claim| {
                    assert_eq!(
                        claim,
                        Capability {
                            publication: PUBLICATION,
                            user: USER,
                            expires: (now() + Duration::minutes(5)).timestamp()
                        }
                    );
                    Ok("signed-cookie".into())
                }),
        ),
    );
    assert_eq!(
        service.exchange(PUBLICATION, &"a".repeat(64)).unwrap(),
        "signed-cookie"
    );
    assert!(matches!(
        service.exchange(PUBLICATION, &"a".repeat(64)),
        Err(Error::Unauthorized)
    ));
}

#[test]
fn expired_and_wrong_audience_cookies_use_anonymous_policy() {
    for claim in [
        Capability {
            publication: PUBLICATION,
            user: USER,
            expires: now().timestamp(),
        },
        Capability {
            publication: PublicationId(Uuid::from_u128(91)),
            user: USER,
            expires: now().timestamp() + 300,
        },
    ] {
        let service = service(
            Unimock::new(
                PublicationsMock::publication
                    .next_call(matching!(_))
                    .returns(Ok(Some(publication()))),
            ),
            Unimock::new(
                AccessPolicyMock::read
                    .next_call(matching!(_, _, None))
                    .returns(Err(Error::Unauthorized)),
            ),
            Unimock::new(
                CapabilitiesMock::verify
                    .next_call(matching!("cookie"))
                    .returns(Ok(claim)),
            ),
        );
        let mut clear = false;
        assert!(matches!(
            service.authorize(PUBLICATION, Some("cookie"), &mut clear),
            Err(Error::Unauthorized)
        ));
        assert!(clear);
    }
}

#[test]
fn valid_cookie_does_not_survive_membership_revocation_or_retention() {
    for expired in [false, true] {
        let mut value = publication();
        if expired {
            value.expired_at = Some(now());
            value.state = PublicationState::Expired;
        }
        let policy = if expired {
            Unimock::new(())
        } else {
            Unimock::new(
                AccessPolicyMock::read
                    .next_call(matching!(_, &PROJECT, Some(USER)))
                    .returns(Err(Error::NotFound)),
            )
        };
        let service = service(
            Unimock::new(
                PublicationsMock::publication
                    .next_call(matching!(_))
                    .returns(Ok(Some(value))),
            ),
            policy,
            Unimock::new(CapabilitiesMock::verify.next_call(matching!(_)).returns(Ok(
                Capability {
                    publication: PUBLICATION,
                    user: USER,
                    expires: now().timestamp() + 300,
                },
            ))),
        );
        assert!(matches!(
            service.authorize(PUBLICATION, Some("cookie"), &mut false),
            Err(Error::NotFound)
        ));
    }
}

#[test]
fn stale_cookie_does_not_deny_public_catalogue_access() {
    let mut public = project();
    public.visibility = Visibility::Public;
    let service = service(
        Unimock::new(
            PublicationsMock::publication
                .next_call(matching!(_))
                .returns(Ok(Some(publication()))),
        ),
        Unimock::new(
            AccessPolicyMock::read
                .next_call(matching!(_, &PROJECT, None))
                .returns(Ok(public)),
        ),
        Unimock::new(
            CapabilitiesMock::verify
                .next_call(matching!("stale"))
                .returns(Err(Error::Unauthorized)),
        ),
    );
    let mut clear = false;
    assert_eq!(
        service
            .authorize(PUBLICATION, Some("stale"), &mut clear)
            .unwrap()
            .project
            .visibility,
        Visibility::Public
    );
    assert!(clear);
}
