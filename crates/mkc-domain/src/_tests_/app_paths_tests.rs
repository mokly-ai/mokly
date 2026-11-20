//! Canonical application path regression coverage.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use crate::app_paths::{
    DASHBOARD, EMAIL_CALLBACK, GITHUB_CALLBACK, GITHUB_INSTALL, PREVIEW_CALLBACK, SIGN_IN, SIGN_UP,
    invitation_acceptance, on_origin, project, publication, pull_request, workspace,
    workspace_billing,
};
use crate::ids::{MemberId, OrganizationId, PublicationId};
use uuid::Uuid;

#[test]
fn paths_use_root_slug_addresses_and_join_an_origin() {
    for path in [
        SIGN_IN,
        SIGN_UP,
        EMAIL_CALLBACK,
        PREVIEW_CALLBACK,
        GITHUB_CALLBACK,
        GITHUB_INSTALL,
        DASHBOARD,
    ] {
        assert!(path.starts_with('/'), "{path}");
        assert!(!path.starts_with("/app/"), "{path}");
    }
    assert_eq!(
        on_origin("https://example.com", GITHUB_CALLBACK),
        "https://example.com/auth/github/callback"
    );
    assert_eq!(
        invitation_acceptance(
            OrganizationId(Uuid::from_u128(1)),
            MemberId(Uuid::from_u128(2))
        ),
        "/workspaces/00000000-0000-0000-0000-000000000001/invitations/00000000-0000-0000-0000-000000000002/accept"
    );
    assert_eq!(PREVIEW_CALLBACK, "/auth/preview/callback");
    let workspace_slug = "mokly".parse().unwrap();
    let project_slug = "cloud".parse().unwrap();
    let publication_id = PublicationId(Uuid::from_u128(2));
    assert_eq!(workspace(&workspace_slug), "/mokly/-");
    assert_eq!(
        workspace_billing(&workspace_slug),
        "/mokly/-/settings/billing"
    );
    assert_eq!(project(&workspace_slug, &project_slug), "/mokly/cloud");
    assert_eq!(
        publication(&workspace_slug, &project_slug, publication_id),
        "/mokly/cloud/publications/00000000-0000-0000-0000-000000000002"
    );
    assert_eq!(
        pull_request(&workspace_slug, &project_slug, 17),
        "/mokly/cloud/pull-requests/17"
    );
}
