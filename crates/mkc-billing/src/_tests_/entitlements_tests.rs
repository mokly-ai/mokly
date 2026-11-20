//! Free, Team and missing-organization entitlement cases.

use std::sync::Arc;

use chrono::Utc;
use mkc_domain::ids::OrganizationId;
use mkc_domain::values::{Plan, Visibility};
use mkc_store_interface::organization::{Organization, OrganizationsMock};
use unimock::{MockFn, Unimock, matching};

use crate::entitlements::{DatabaseEntitlements, Entitlements};
use crate::error::{Error, Feature};

#[test]
fn free_plan_defaults_public_and_refuses_private_projects() {
    let organization = organization_id();
    let mut queries = plan_queries(Plan::Free);
    assert_eq!(
        DatabaseEntitlements
            .plan(&mut queries, organization)
            .unwrap(),
        Plan::Free
    );
    assert_eq!(
        DatabaseEntitlements
            .default_visibility(&mut queries, organization)
            .unwrap(),
        Visibility::Public
    );
    assert!(matches!(
        DatabaseEntitlements.require_private_projects(&mut queries, organization),
        Err(Error::PlanRequired {
            required: Plan::Team,
            feature: Feature::PrivateProjects,
        })
    ));
}

#[test]
fn team_plan_defaults_private_and_allows_private_projects() {
    let organization = organization_id();
    let mut queries = plan_queries(Plan::Team);
    assert_eq!(
        DatabaseEntitlements
            .plan(&mut queries, organization)
            .unwrap(),
        Plan::Team
    );
    assert_eq!(
        DatabaseEntitlements
            .default_visibility(&mut queries, organization)
            .unwrap(),
        Visibility::Private
    );
    DatabaseEntitlements
        .require_private_projects(&mut queries, organization)
        .unwrap();
}

#[test]
fn a_missing_organization_is_not_an_implicit_free_plan() {
    let organization = organization_id();
    let mut queries = Unimock::new(
        OrganizationsMock::organization
            .next_call(matching!(_))
            .returns(Ok(None)),
    );
    assert!(matches!(
        DatabaseEntitlements.plan(&mut queries, organization),
        Err(Error::NotFound)
    ));
}

fn plan_queries(plan: Plan) -> Unimock {
    Unimock::new(
        OrganizationsMock::organization
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| Ok(Some(organization(plan))))),
    )
}

fn organization_id() -> OrganizationId {
    OrganizationId(Default::default())
}

fn organization(plan: Plan) -> Organization {
    Organization {
        id: organization_id(),
        name: "Entitled organization".into(),
        slug: "entitled-organization".parse().unwrap(),
        version: 1,
        created_at: Utc::now(),
        plan,
    }
}
