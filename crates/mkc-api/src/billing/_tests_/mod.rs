//! Billing policy unit tests use the same role decision as the service.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use mkc_billing_interface::error::{Error as ProviderError, ProviderDetail};
use mkc_domain::values::Role;

use crate::error::ApiError;

use super::error::Error;
use super::service::{Permission, authorize};

#[test]
fn billing_permissions_match_read_and_manage_roles() {
    assert!(authorize(Role::Owner, Permission::Read).is_ok());
    assert!(authorize(Role::Admin, Permission::Read).is_ok());
    assert!(authorize(Role::Member, Permission::Read).is_err());
    assert!(authorize(Role::Reviewer, Permission::Read).is_err());
    assert!(authorize(Role::Owner, Permission::Manage).is_ok());
    for role in [Role::Admin, Role::Member, Role::Reviewer] {
        assert!(authorize(role, Permission::Manage).is_err());
    }
}

#[test]
fn provider_failures_map_to_the_public_retry_contract() {
    assert!(matches!(
        ApiError::from(Error::from_provider(ProviderError::RateLimited {
            retry_after: 17,
            detail: ProviderDetail::none(),
        })),
        ApiError::RateLimited(17)
    ));
    assert!(matches!(
        ApiError::from(Error::from_provider(ProviderError::Unavailable)),
        ApiError::Unavailable
    ));
    assert!(matches!(
        ApiError::from(Error::from_provider(ProviderError::Unauthorized {
            detail: ProviderDetail::none(),
        })),
        ApiError::Internal(_)
    ));
    assert!(matches!(
        ApiError::from(Error::from_provider(ProviderError::PermissionDenied {
            detail: ProviderDetail::none(),
        })),
        ApiError::Internal(_)
    ));
}
