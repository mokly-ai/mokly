//! Open-first ordering, timestamp ties and PR-number publication association.

use mkc_store_interface::github_refs::PullRequest;
use mkc_store_interface::publication::PublicationState;

use super::support::{run, time};

#[test]
fn stored_repository_identities_supply_the_fork_rule_without_builds() {
    run(&mut |q, fixture| {
        q.link_github_project(fixture.project, fixture.repository.id)?;
        let bound = fixture.repository.github_id;
        for (index, head, base, fork) in [
            (1, Some(bound), Some(bound), false),
            (2, Some(bound + 1), Some(bound), true),
            (3, None, Some(bound), true),
            (4, Some(bound), Some(bound + 1), true),
            (5, Some(bound), None, true),
        ] {
            q.save_github_pull_request(&PullRequest {
                repository_id: fixture.repository.id,
                number: index,
                title: format!("PR {index}"),
                author: None,
                open: false,
                merged: false,
                head_ref: "topic".into(),
                head_sha: "a".repeat(40),
                base_ref: "main".into(),
                base_sha: "b".repeat(40),
                head_repository_id: head,
                base_repository_id: base,
                updated_at: time(index),
            })?;
            let row = q.viewer_pull_requests(fixture.project, None, 1)?.remove(0);
            assert_eq!(row.repositories.bound, bound);
            assert_eq!(row.repositories.head, head);
            assert_eq!(row.repositories.base, base);
            assert_eq!(row.repositories.is_fork(), fork);
            assert!(row.newest_build.is_none());
        }
        Ok(())
    });
}

#[test]
fn pull_requests_page_by_state_time_and_number_with_scoped_latest() {
    run(&mut |q, fixture| {
        assert!(
            q.viewer_pull_requests(fixture.project, None, 100)?
                .is_empty()
        );
        q.link_github_project(fixture.project, fixture.repository.id)?;
        for (number, open, merged, updated) in [
            (7, true, false, 2),
            (8, true, false, 2),
            (9, false, true, 5),
            (10, false, false, 8),
        ] {
            q.save_github_pull_request(&PullRequest {
                repository_id: fixture.repository.id,
                number,
                title: format!("PR {number}"),
                author: (number != 9).then(|| "octocat".into()),
                open,
                merged,
                head_ref: "feature".into(),
                head_sha: "a".repeat(40),
                base_ref: "main".into(),
                base_sha: "b".repeat(40),
                head_repository_id: Some(100),
                base_repository_id: Some(100),
                updated_at: time(updated),
            })?;
        }
        let ready = fixture.publication(20, "unrelated-branch", 1, PublicationState::Ready);
        q.insert_publication(&ready)?;
        q.insert_publication(&fixture.publication(21, "feature", 2, PublicationState::Expired))?;
        q.insert_publication(&fixture.publication(22, "feature", 3, PublicationState::Failed))?;
        let mut foreign = fixture.publication(23, "feature", 4, PublicationState::Ready);
        foreign.project_id = fixture.other;
        q.insert_publication(&foreign)?;
        let rows = q.viewer_pull_requests(fixture.project, None, 100)?;
        assert_eq!(
            rows.iter().map(|r| r.key.number).collect::<Vec<_>>(),
            [8, 7, 10, 9]
        );
        assert_eq!(rows[1].latest_publication_id, Some(ready.id));
        assert!(rows[0].latest_publication_id.is_none());
        assert!(rows[0].newest_publication.is_none());
        assert_eq!(rows[1].author.as_deref(), Some("octocat"));
        assert!(rows[3].author.is_none());
        assert!(rows[3].merged);
        let rest = q.viewer_pull_requests(fixture.project, Some(&rows[0].key), 2)?;
        assert_eq!(
            rest.iter().map(|r| r.key.number).collect::<Vec<_>>(),
            [7, 10]
        );
        assert_eq!(
            q.viewer_pull_requests(fixture.project, Some(&rest[1].key), 100)?[0]
                .key
                .number,
            9
        );
        Ok(())
    });
}
