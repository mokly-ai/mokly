//! Reference unions and contextual build reads in their owning repository.

use chrono::Duration;
use mkc_store_interface::github_refs::PullRequest;
use mkc_store_interface::publication::{PublicationFailure, PublicationState};
use mkc_store_interface::store::Callback;

use super::support::fixture;

#[test]
fn reference_rows_include_build_only_branches_and_skip_failed_build_uploads() {
    let Some(f) = fixture() else {
        return;
    };
    let mut old = f.build("topic", 1);
    old.pull_request = Some(7);
    f.schedule(&old);
    let mut new = f.build("topic", 2);
    new.pull_request = Some(7);
    new.created_at += Duration::seconds(1);
    f.schedule(&new);
    let mut failed = f.publication(&new);
    failed.state = PublicationState::Failed;
    failed.changes = None;
    failed.failure = Some(PublicationFailure::InvalidBundle);
    let pr = PullRequest {
        repository_id: f.repository.id,
        number: 7,
        title: "Test PR".into(),
        author: Some("test-user".into()),
        open: true,
        merged: false,
        head_ref: new.branch.clone(),
        head_sha: new.head_sha.clone(),
        base_ref: "main".into(),
        base_sha: "a".repeat(40),
        head_repository_id: Some(100),
        base_repository_id: Some(100),
        updated_at: f.now,
    };
    f.store
        .transaction(&mut Callback(&mut |q| {
            q.insert_publication(&failed)?;
            q.save_github_pull_request(&pr)
        }))
        .unwrap();
    f.store
        .read(&mut Callback(&mut |q| {
            let branches = q.viewer_branches(f.project.id, None, 100)?;
            assert_eq!(branches.len(), 1);
            assert_eq!(branches[0].key.name, "topic");
            assert_eq!(branches[0].updated_at, new.created_at);
            assert_eq!(branches[0].newest_build.as_ref().unwrap().id, new.id);
            assert!(branches[0].newest_publication.is_none());
            let prs = q.viewer_pull_requests(f.project.id, None, 100)?;
            assert_eq!(prs[0].newest_build.as_ref().unwrap().id, new.id);
            assert!(prs[0].newest_publication.is_none());
            let build = q.viewer_build(f.project.id, new.id)?.unwrap();
            assert_eq!(build.pull_request.as_ref().unwrap().title, "Test PR");
            assert_eq!(
                build.pull_request.as_ref().unwrap().author.as_deref(),
                Some("test-user")
            );
            assert_eq!(
                build.pull_request.as_ref().unwrap().repository,
                f.repository.full_name
            );
            assert!(
                q.viewer_build(uuid::Uuid::now_v7().into(), new.id)?
                    .is_none()
            );
            Ok(())
        }))
        .unwrap();
}
