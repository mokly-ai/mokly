//! Preview seed accounts reuse authentication policy without session issuance.

use std::sync::Arc;

use mkc_domain::ids::UserId;
use mkc_store_interface::user::{User, UsersMock};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::error::Error;
use crate::runtime::RuntimeMock;
use crate::service::{Authenticator, PreviewSignIn};

use super::support::{now, pure, service};

#[test]
fn preview_account_is_created_once_and_reused_without_a_session() {
    assert!(matches!(
        pure().preview_account(),
        Err(Error::PreviewSignInUnavailable)
    ));
    let expected = User {
        id: UserId(Uuid::from_u128(9)),
        email: "preview@example.com".to_owned(),
        name: "preview@example.com".to_owned(),
        created_at: now(),
    };
    let reused = expected.clone();
    let queries = Unimock::new((
        UsersMock::find_user.stub(|each| {
            each.call(matching!("preview@example.com"))
                .answers(&|_, _| Ok(None))
                .once()
                .then()
                .answers_arc(Arc::new(move |_, _| Ok(Some(reused.clone()))))
                .once();
        }),
        UsersMock::insert_user
            .some_call(matching!((user,) if user.id.0 == Uuid::from_u128(9)
                && user.email == "preview@example.com" && user.name == "preview@example.com"
                && user.created_at == now()))
            .returns(Ok(())),
    ));
    let runtime = Unimock::new((
        RuntimeMock::now.each_call(matching!()).returns(now()),
        RuntimeMock::id.stub(|each| {
            each.call(matching!())
                .returns(Uuid::from_u128(9))
                .once()
                .then()
                .returns(Uuid::from_u128(10))
                .once();
        }),
    ));
    let mut auth = service(queries, Arc::new(Unimock::new(())), runtime);
    auth.preview_sign_in = Some(PreviewSignIn::new(expected.email.clone(), None));
    for _ in 0..2 {
        let result = auth.preview_account();
        assert!(
            result.is_ok(),
            "configured preview account failed: {result:?}"
        );
        let user = result.unwrap();
        assert_eq!(user.id, expected.id);
        assert_eq!(user.email, expected.email);
        assert_eq!(user.name, expected.name);
        assert_eq!(user.created_at, expected.created_at);
    }
}
