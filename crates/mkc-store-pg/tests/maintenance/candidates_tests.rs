//! Ineligible publications must never occupy a bounded maintenance batch.

use chrono::{Duration, Utc};
use mkc_domain::values::{Plan, Visibility};
use mkc_store_interface::organization::Organization;
use mkc_store_interface::project::Project;
use mkc_store_interface::publication::{
    Publication, PublicationFailure, PublicationMetadata, PublicationState,
};
use mkc_store_interface::publication_changes::Changes;
use mkc_store_interface::store::Callback;
use uuid::Uuid;

use super::fixtures::database;

#[test]
fn recent_attempts_and_old_ready_publications_cannot_starve_due_candidates() {
    let Some(db) = database() else { return };
    let now = Utc::now();
    let org = Organization {
        id: Uuid::now_v7().into(),
        name: "Retention".into(),
        slug: format!("o-{}", Uuid::now_v7().simple()).parse().unwrap(),
        version: 1,
        created_at: now,
        plan: Plan::Free,
    };
    let project = Project {
        id: Uuid::now_v7().into(),
        organization_id: org.id,
        name: "Retention".into(),
        slug: format!("p-{}", Uuid::now_v7().simple()).parse().unwrap(),
        repository: "test/retention".into(),
        config_path: "mokly.config.ts".into(),
        visibility: Visibility::Private,
        require_approval: false,
        automatic_builds: false,
        version: 1,
    };
    db.store
        .transaction(&mut Callback(&mut |q| {
            q.insert_organization(&org)?;
            q.insert_project(&project)?;
            for index in 1..=400 {
                let stale = index > 198;
                let ready = (199..=398).contains(&index);
                q.insert_publication(&Publication {
                    id: Uuid::from_u128(index).into(),
                    project_id: project.id,
                    metadata: ready.then(|| PublicationMetadata {
                        branch: "feature".into(),
                        head_sha: format!("{index:040x}"),
                        base_ref: None,
                        base_sha: None,
                        pull_request: None,
                        config_path: project.config_path.clone(),
                        exported_at: now,
                    }),
                    state: if index == 400 {
                        PublicationState::Failed
                    } else if ready {
                        PublicationState::Ready
                    } else {
                        PublicationState::Uploading
                    },
                    failure: (index == 400).then_some(PublicationFailure::Internal),
                    changes: ready.then_some(Changes::NoComparison),
                    created_at: now - Duration::days(if stale { 30 } else { 0 }),
                    deadline: if index == 399 {
                        now
                    } else {
                        now + Duration::minutes(15)
                    },
                    expired_at: None,
                    build_id: None,
                    build_failure_event_id: None,
                })?;
            }
            let candidates = q.publication_candidates(now, now - Duration::days(30), None, 100)?;
            assert_eq!(
                candidates
                    .iter()
                    .map(|p| p.id.0.as_u128())
                    .collect::<Vec<_>>(),
                vec![399, 400]
            );
            Ok(())
        }))
        .unwrap();
}
