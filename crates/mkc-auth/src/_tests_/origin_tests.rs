//! Request classification and CSRF keep catalogue frames outside the admitted set.

use mkc_domain::client_origins::{AdmittedOrigins, ClientOrigin, DESKTOP_ORIGIN};

use crate::error::Error;
use crate::service::Authenticator;

use super::support::{identity, pure};

#[test]
fn both_origin_and_csrf_use_the_same_admission_policy() {
    let app = "https://app.example.com";
    for desktop in [false, true] {
        let mut auth = pure();
        auth.origins = AdmittedOrigins::new(app.to_owned(), desktop);
        for (origin, expected) in [
            (Some(app), Some(ClientOrigin::App)),
            (
                Some(DESKTOP_ORIGIN),
                desktop.then_some(ClientOrigin::Desktop),
            ),
            (None, None),
            (Some("null"), None),
            (Some("https://p-123.catalogues.example.net"), None),
            (Some("mokly-app://desktop/"), None),
        ] {
            for result in [
                auth.origin(origin),
                auth.csrf(&identity(), origin, Some("csrf")),
            ] {
                match expected {
                    Some(client) => assert_eq!(result.unwrap(), client),
                    None => assert!(matches!(result, Err(Error::CsrfFailed))),
                }
            }
            for token in [None, Some("wrong")] {
                assert!(matches!(
                    auth.csrf(&identity(), origin, token),
                    Err(Error::CsrfFailed)
                ));
            }
        }
    }
}
