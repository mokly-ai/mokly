//! Entropy errors remain internal at each credential generation call site.

use std::sync::Arc;

use mkc_domain::client_origins::ClientOrigin;

use unimock::{MockFn, Unimock, matching};

use crate::runtime::RuntimeMock;
use crate::service::{AuthService, Authenticator};

use super::failure_fixture::{assert_internal, failure};
use super::support::{now, pure};

fn service(after_one_secret: bool) -> AuthService {
    let clock = RuntimeMock::now.next_call(matching!()).returns(now());
    let runtime = if after_one_secret {
        Unimock::new((
            clock,
            RuntimeMock::secret
                .next_call(matching!())
                .returns(Ok("a".repeat(64))),
            RuntimeMock::secret
                .next_call(matching!())
                .returns(Err(failure())),
        ))
    } else {
        Unimock::new((
            clock,
            RuntimeMock::secret
                .next_call(matching!())
                .returns(Err(failure())),
        ))
    };
    let mut auth = pure();
    auth.runtime = Arc::new(runtime);
    auth
}

#[test]
fn link_credential_failure_is_internal() {
    let error = service(false)
        .issue("person@example.com", None, "127.0.0.1", ClientOrigin::App)
        .err()
        .unwrap();
    assert_internal(error, "generate credential");
}

#[test]
fn exchange_session_credential_failure_is_internal() {
    let error = service(false).verify(&"a".repeat(64), None).err().unwrap();
    assert_internal(error, "generate credential");
}

#[test]
fn exchange_csrf_credential_failure_is_internal() {
    let error = service(true).verify(&"a".repeat(64), None).err().unwrap();
    assert_internal(error, "generate credential");
}

#[test]
fn rotation_session_credential_failure_is_internal() {
    let error = service(false).rotate("cookie").err().unwrap();
    assert_internal(error, "generate credential");
}

#[test]
fn rotation_csrf_credential_failure_is_internal() {
    let error = service(true).rotate("cookie").err().unwrap();
    assert_internal(error, "generate credential");
}
