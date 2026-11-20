//! Publication origin uses its admitted PR number and bound repository only.

use mkc_store_interface::github_refs::PullRequest;
use mkc_store_interface::publication::PublicationState;
use mkc_store_interface::viewer::HistoryFilter;

use super::support::{run, time};

#[test]
fn publication_context_joins_admitted_pr_without_branch_or_sha_guessing() {
    run(&mut |q, fixture| {
        q.link_github_project(fixture.project, fixture.repository.id)?;
        let pull = PullRequest {
            repository_id: fixture.repository.id,
            number: 7,
            title: "Original pull request".into(),
            author: Some("octocat".into()),
            open: false,
            merged: true,
            head_ref: "renamed-after-upload".into(),
            head_sha: "c".repeat(40),
            base_ref: "main".into(),
            base_sha: "b".repeat(40),
            head_repository_id: Some(100),
            base_repository_id: Some(100),
            updated_at: time(100),
        };
        q.save_github_pull_request(&pull)?;
        let row = fixture.publication(60, "old-name", 1, PublicationState::Ready);
        q.insert_publication(&row)?;
        let mut branch_only =
            fixture.publication(61, "renamed-after-upload", 2, PublicationState::Ready);
        branch_only.metadata.as_mut().unwrap().pull_request = None;
        q.insert_publication(&branch_only)?;
        let mut unseen = fixture.publication(62, "old-name", 3, PublicationState::Failed);
        unseen.metadata.as_mut().unwrap().pull_request = Some(99);
        q.insert_publication(&unseen)?;
        let mut unbound = fixture.publication(63, "old-name", 4, PublicationState::Ready);
        unbound.project_id = fixture.other;
        q.insert_publication(&unbound)?;
        let result = q.viewer_publication(fixture.project, row.id)?.unwrap();
        let origin = result.pull_request.unwrap();
        assert_eq!(origin.number, 7);
        assert_eq!(origin.title, pull.title);
        assert_eq!(origin.author, pull.author);
        assert_eq!(origin.repository, fixture.repository.full_name);
        for id in [branch_only.id, unseen.id] {
            assert!(
                q.viewer_publication(fixture.project, id)?
                    .unwrap()
                    .pull_request
                    .is_none()
            );
        }
        assert!(
            q.viewer_publication(fixture.other, unbound.id)?
                .unwrap()
                .pull_request
                .is_none()
        );
        assert!(q.viewer_publication(fixture.other, row.id)?.is_none());
        let history =
            q.viewer_publications(fixture.project, &HistoryFilter::default(), None, 100)?;
        assert!(history[0].pull_request.is_none());
        assert!(history[1].pull_request.is_none());
        assert_eq!(history[2].pull_request.as_ref().unwrap().number, 7);
        let mut historical = pull;
        historical.author = None;
        q.save_github_pull_request(&historical)?;
        assert!(
            q.viewer_publication(fixture.project, row.id)?
                .unwrap()
                .pull_request
                .unwrap()
                .author
                .is_none()
        );
        assert!(q.expire_publication(row.id, time(200))?);
        let history =
            q.viewer_publications(fixture.project, &HistoryFilter::default(), None, 100)?;
        assert_eq!(history[2].pull_request.as_ref().unwrap().number, 7);
        Ok(())
    });
}
