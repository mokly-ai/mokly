//! Distinct strongest-role seat counting across membership and grant sources.

use chrono::{Duration, Utc};
use mkc_domain::ids::{OrganizationId, ProjectId, UserId};
use mkc_domain::values::{Plan, Role, Visibility};
use mkc_store_interface::error::Result;
use mkc_store_interface::grant::Grant;
use mkc_store_interface::member::Member;
use mkc_store_interface::project::Project;
use mkc_store_interface::store::Queries;
use mkc_store_interface::user::User;
use uuid::Uuid;

use super::support;

#[test]
fn seats_deduplicate_users_and_keep_their_strongest_role() {
    support::run(&mut |queries| {
        let organization = support::organization("Seat counts", Plan::Team);
        let other_organization = support::organization("Other seats", Plan::Free);
        queries.insert_organization(&organization)?;
        queries.insert_organization(&other_organization)?;

        let member_and_grantee = insert_user(queries, "member-grantee")?;
        let owner_and_reviewer = insert_user(queries, "owner-reviewer")?;
        let reviewer_only = insert_user(queries, "reviewer-only")?;
        let other_grantee = insert_user(queries, "other-grantee")?;

        insert_member(queries, organization.id, member_and_grantee, Role::Member)?;
        insert_member(queries, organization.id, owner_and_reviewer, Role::Owner)?;
        insert_member(queries, organization.id, reviewer_only, Role::Reviewer)?;
        queries.insert_member(&Member {
            id: Uuid::now_v7().into(),
            organization_id: organization.id,
            user_id: None,
            email: format!("pending-{}@example.com", Uuid::now_v7()),
            role: Role::Member,
            version: 1,
            expires_at: Some(Utc::now() + Duration::days(1)),
        })?;

        let project = insert_project(queries, organization.id, "seat-counts")?;
        let other_project = insert_project(queries, other_organization.id, "other-seats")?;
        insert_grant(queries, project.id, member_and_grantee, Role::Reviewer)?;
        insert_grant(queries, project.id, owner_and_reviewer, Role::Reviewer)?;
        insert_grant(queries, other_project.id, other_grantee, Role::Reviewer)?;

        let seats = queries.seat_counts(organization.id)?;
        assert_eq!(seats.editors, 2);
        assert_eq!(seats.collaborators, 1);
        let other_seats = queries.seat_counts(other_organization.id)?;
        assert_eq!(other_seats.editors, 0);
        assert_eq!(other_seats.collaborators, 1);
        Ok(())
    });
}

fn insert_user(queries: &mut dyn Queries, label: &str) -> Result<UserId> {
    let id = Uuid::now_v7();
    queries.insert_user(&User {
        id: id.into(),
        name: label.into(),
        email: format!("{label}-{id}@example.com"),
        created_at: Utc::now(),
    })?;
    Ok(id.into())
}

fn insert_member(
    queries: &mut dyn Queries,
    organization: OrganizationId,
    user: UserId,
    role: Role,
) -> Result<()> {
    queries.insert_member(&Member {
        id: Uuid::now_v7().into(),
        organization_id: organization,
        user_id: Some(user),
        email: format!("{user:?}@example.com"),
        role,
        version: 1,
        expires_at: None,
    })
}

fn insert_project(
    queries: &mut dyn Queries,
    organization: OrganizationId,
    label: &str,
) -> Result<Project> {
    let project = Project {
        id: Uuid::now_v7().into(),
        organization_id: organization,
        name: label.into(),
        slug: label.parse().unwrap(),
        repository: format!("test/{label}-{}", Uuid::now_v7()),
        config_path: "mokly.config.ts".into(),
        visibility: Visibility::Private,
        require_approval: false,
        automatic_builds: false,
        version: 1,
    };
    queries.insert_project(&project)?;
    Ok(project)
}

fn insert_grant(
    queries: &mut dyn Queries,
    project: ProjectId,
    user: UserId,
    role: Role,
) -> Result<()> {
    queries.insert_grant(&Grant {
        id: Uuid::now_v7().into(),
        project_id: project,
        user_id: user,
        role,
        version: 1,
    })
}
