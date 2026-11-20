//! Permissive persistence fixtures; authorization still runs in the real command.

use std::sync::Arc;

use chrono::Duration;
use mkc_domain::values::{Plan, Role};
use mkc_store_interface::billing_subscription::BillingSubscriptionsMock;
use mkc_store_interface::github_installation::GitHubInstallationsMock;
use mkc_store_interface::integration::IntegrationsMock;
use mkc_store_interface::member::MembersMock;
use mkc_store_interface::organization::{OrganizationLookup, OrganizationsMock};
use mkc_store_interface::user::UsersMock;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::action::Action;

use super::project_fixture;
use super::support::{member, now, user, workspace};

/// Methods are optional across commands; assertions cover outcomes, not call counts.
pub(super) fn queries(role: Option<Role>, action: &Action) -> Unimock {
    queries_with_plan(role, action, Plan::Free)
}

pub(super) fn queries_with_plan(role: Option<Role>, action: &Action, plan: Plan) -> Unimock {
    let mut target = member(if matches!(action, Action::RemoveMember(..)) {
        Role::Owner
    } else {
        Role::Member
    });
    target.id = Uuid::from_u128(20).into();
    target.user_id = Some(Uuid::from_u128(21).into());
    target.email = "target@example.com".into();
    if matches!(action, Action::Accept(..)) {
        target.user_id = None;
        target.email = user().email;
        target.expires_at = Some(now() + Duration::days(1));
    }
    let mut members: Vec<_> = role.map(member).into_iter().collect();
    members.push(target.clone());
    Unimock::new((
        (
            MembersMock::members
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| Ok(members.clone())))
                .at_least_times(0),
            MembersMock::user_memberships
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    Ok(role.map(member).into_iter().collect())
                }))
                .at_least_times(0),
            MembersMock::member
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| Ok(Some(target.clone()))))
                .at_least_times(0),
            MembersMock::insert_member
                .each_call(matching!(_))
                .answers(&|_, _| Ok(()))
                .at_least_times(0),
            MembersMock::save_member
                .each_call(matching!(_))
                .answers(&|_, _| Ok(()))
                .at_least_times(0),
            MembersMock::delete_member
                .each_call(matching!(_))
                .answers(&|_, _| Ok(()))
                .at_least_times(0),
        ),
        (
            UsersMock::user
                .each_call(matching!(_))
                .answers(&|_, id| {
                    Ok(Some({
                        let mut user = user();
                        user.id = id;
                        user
                    }))
                })
                .at_least_times(0),
            UsersMock::save_user
                .each_call(matching!(_))
                .answers(&|_, _| Ok(()))
                .at_least_times(0),
            IntegrationsMock::integration
                .each_call(matching!(_))
                .answers(&|_, _| Ok(None))
                .at_least_times(0),
            OrganizationsMock::organization
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    let mut workspace = workspace();
                    workspace.plan = plan;
                    Ok(Some(workspace))
                }))
                .at_least_times(0),
            OrganizationsMock::find_organization_by_slug
                .each_call(matching!(_))
                .answers(&|_, _| {
                    Ok(Some(OrganizationLookup {
                        value: workspace(),
                        retired: false,
                    }))
                })
                .at_least_times(0),
            OrganizationsMock::organization_slug_claimed
                .each_call(matching!(_))
                .answers(&|_, _| Ok(false))
                .at_least_times(0),
            OrganizationsMock::insert_organization
                .each_call(matching!(_))
                .answers(&|_, _| Ok(()))
                .at_least_times(0),
            OrganizationsMock::save_organization
                .each_call(matching!(_))
                .answers(&|_, _| Ok(()))
                .at_least_times(0),
            OrganizationsMock::delete_organization
                .each_call(matching!(_))
                .answers(&|_, _| Ok(()))
                .at_least_times(0),
        ),
        project_fixture::queries(action),
        GitHubInstallationsMock::github_installations
            .each_call(matching!(_))
            .answers(&|_, _| Ok(Vec::new()))
            .at_least_times(0),
        BillingSubscriptionsMock::billing_subscription
            .each_call(matching!(_))
            .answers(&|_, _| Ok(None))
            .at_least_times(0),
    ))
    .no_verify_in_drop()
}
