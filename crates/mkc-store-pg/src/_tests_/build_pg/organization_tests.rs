//! Claim limits span projects while other organizations remain claimable.

use mkc_domain::values::Plan;
use mkc_store_interface::github_installation::Installation;
use mkc_store_interface::github_state::AccountKind;
use mkc_store_interface::organization::Organization;
use mkc_store_interface::store::Callback;
use uuid::Uuid;

use super::support::{attempt, fixture};

#[test]
fn two_live_leases_across_projects_block_their_organization_only() {
    let Some(f) = fixture() else {
        return;
    };
    let one = f.build("one", 1);
    f.schedule(&one);
    let mut shared = f.project.clone();
    shared.id = Uuid::now_v7().into();
    shared.slug = "shared".parse().unwrap();
    shared.config_path = "shared.config.ts".into();
    let mut two = f.build("two", 2);
    two.project_id = shared.id;
    two.config_path = shared.config_path.clone();
    let org = Organization {
        id: Uuid::now_v7().into(),
        name: "Other".into(),
        slug: "other".parse().unwrap(),
        version: 1,
        created_at: f.now,
        plan: Plan::Free,
    };
    let mut other = f.project.clone();
    other.id = Uuid::now_v7().into();
    other.organization_id = org.id;
    other.slug = "other".parse().unwrap();
    let installation = Installation {
        id: Uuid::now_v7().into(),
        github_id: 2,
        app_id: 1,
        organization_id: Some(org.id),
        account_id: 2,
        account_name: "other".into(),
        account_kind: AccountKind::Organization,
        manage_url: "https://github.com/settings/installations/2".into(),
        active: true,
        connected: true,
        updated_at: f.now,
    };
    let mut repository = f.repository.clone();
    repository.id = Uuid::now_v7().into();
    repository.installation_id = installation.id;
    repository.github_id = 2;
    repository.full_name = "other/builds".into();
    other.repository = repository.full_name.clone();
    let mut third = f.build("three", 3);
    third.project_id = other.id;
    third.repository_id = repository.id;
    f.store
        .transaction(&mut Callback(&mut |q| {
            q.insert_project(&shared)?;
            q.link_github_project(shared.id, f.repository.id)?;
            q.insert_organization(&org)?;
            q.insert_project(&other)?;
            q.save_github_installation(&installation)?;
            q.save_github_repository(&repository)?;
            q.link_github_project(other.id, repository.id)?;
            q.schedule_build(&two)?;
            q.schedule_build(&third)?;
            q.start_build(one.id, &attempt(f.now))?.unwrap();
            q.start_build(two.id, &attempt(f.now))?.unwrap();
            assert_eq!(q.claim_build(&|| f.now)?.unwrap().id, third.id);
            assert!(q.start_build(third.id, &attempt(f.now))?.is_some());
            assert!(q.claim_build(&|| f.now)?.is_none());
            let mut stored = q.project(shared.id)?.unwrap();
            stored.automatic_builds = true;
            q.save_project(&stored)?;
            assert!(q.project(shared.id)?.unwrap().automatic_builds);
            Ok(())
        }))
        .unwrap();
}
