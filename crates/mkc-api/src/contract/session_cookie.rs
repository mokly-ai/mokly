//! One shared session cookie header for every response that sets or clears it.

use utoipa::Modify;
use utoipa::openapi::header::HeaderBuilder;
use utoipa::openapi::{OpenApi, Ref, RefOr};

use super::operations::operations_mut;

/// Name of the shared header under `components.headers`.
const COMPONENT: &str = "SessionCookie";

/// The current-request Origin rule of the authentication protocol.
const DESCRIPTION: &str = "Secure HttpOnly mkc_session cookie with Path=/ and no Domain attribute. SameSite follows the current request's Origin on every exchange, rotation and clearing response. The public app origin receives SameSite=Lax; mokly-app://desktop receives SameSite=None when MKC_DESKTOP_CLIENT is true. Issuance uses Max-Age=2592000; sign-out clears the cookie with Max-Age=0 and the same Origin rule. See docs/protocol/cloud/auth-sessions.md#sessions.";

/// Replaces each declared `Set-Cookie` response header with a reference to the
/// shared component, so every session response states the same Origin rule.
pub(super) struct SessionCookie;

impl Modify for SessionCookie {
    fn modify(&self, document: &mut OpenApi) {
        let reference = format!("#/components/headers/{COMPONENT}");
        let mut declared = false;
        for operation in document.paths.paths.values_mut().flat_map(operations_mut) {
            for response in operation.responses.responses.values_mut() {
                if let RefOr::T(response) = response
                    && let Some(header) = response.headers.get_mut("Set-Cookie")
                {
                    *header = RefOr::Ref(Ref::new(reference.clone()));
                    declared = true;
                }
            }
        }
        if declared {
            document.components.get_or_insert_default().headers.insert(
                COMPONENT.to_owned(),
                RefOr::T(HeaderBuilder::new().description(Some(DESCRIPTION)).build()),
            );
        }
    }
}
