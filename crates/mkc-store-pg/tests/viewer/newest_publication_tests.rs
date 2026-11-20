//! Newest attempt metadata remains independent of the retained ready target.

use mkc_store_interface::github_refs::PullRequest;
use mkc_store_interface::publication::{PublicationFailure, PublicationState};

use super::support::{run, time};

#[test]
fn reference_summaries_use_admission_and_id_across_lifecycle_states() {
    run(&mut |q, fixture| {
        q.link_github_project(fixture.project, fixture.repository.id)?;
        q.save_github_pull_request(&PullRequest {
            repository_id: fixture.repository.id,
            number: 7,
            title: "Reference summary".into(),
            author: Some("octocat".into()),
            open: true,
            merged: false,
            head_ref: "feature".into(),
            head_sha: "f".repeat(40),
            base_ref: "main".into(),
            base_sha: "b".repeat(40),
            head_repository_id: Some(100),
            base_repository_id: Some(100),
            updated_at: time(500),
        })?;
        let ready = fixture.publication(70, "feature", 1, PublicationState::Ready);
        let failed = fixture.publication(71, "feature", 2, PublicationState::Failed);
        let pending = fixture.publication(72, "feature", 2, PublicationState::Validating);
        let expired = fixture.publication(73, "feature", 3, PublicationState::Expired);
        for row in [&ready, &failed, &pending, &expired] {
            q.insert_publication(row)?;
            let branch = &q.viewer_branches(fixture.project, None, 100)?[0];
            let pull = &q.viewer_pull_requests(fixture.project, None, 100)?[0];
            for (summary, latest) in [
                (
                    branch.newest_publication.as_ref().unwrap(),
                    branch.latest_publication_id,
                ),
                (
                    pull.newest_publication.as_ref().unwrap(),
                    pull.latest_publication_id,
                ),
            ] {
                assert_eq!(latest, Some(ready.id));
                assert_eq!(summary.id, row.id);
                assert_eq!(summary.state, row.state);
                assert_eq!(summary.created_at, row.created_at);
                assert_eq!(
                    summary.head_sha,
                    row.metadata.as_ref().map(|m| m.head_sha.clone())
                );
            }
        }
        Ok(())
    });
}

#[test]
fn replay_attempts_preserve_reference_summaries_and_genuine_failures() {
    run(&mut |q, fixture| {
        q.link_github_project(fixture.project, fixture.repository.id)?;
        q.save_github_pull_request(&PullRequest {
            repository_id: fixture.repository.id,
            number: 7,
            title: "Replayed publication".into(),
            author: None,
            open: true,
            merged: false,
            head_ref: "feature".into(),
            head_sha: "a".repeat(40),
            base_ref: "main".into(),
            base_sha: "b".repeat(40),
            head_repository_id: Some(fixture.repository.github_id),
            base_repository_id: Some(fixture.repository.github_id),
            updated_at: time(10),
        })?;
        let ready = fixture.publication(80, "feature", 1, PublicationState::Ready);
        let failed = fixture.publication(82, "feature", 3, PublicationState::Failed);
        for (publication, replay_id, replay_time) in [(&ready, 81, 2), (&failed, 83, 4)] {
            q.insert_publication(publication)?;
            let mut replay =
                fixture.publication(replay_id, "feature", replay_time, PublicationState::Failed);
            replay.metadata = ready.metadata.clone();
            replay.failure = Some(PublicationFailure::Superseded);
            q.insert_publication(&replay)?;
            let branch = q.viewer_branches(fixture.project, None, 100)?.remove(0);
            let pull = q
                .viewer_pull_requests(fixture.project, None, 100)?
                .remove(0);
            assert_eq!(
                [
                    branch.newest_publication.map(|summary| summary.id),
                    pull.newest_publication.map(|summary| summary.id),
                ],
                [Some(publication.id), Some(publication.id)],
                "reference summaries must skip replay attempts"
            );
            assert_eq!(
                [branch.latest_publication_id, pull.latest_publication_id],
                [Some(ready.id), Some(ready.id)]
            );
        }
        Ok(())
    });
}
