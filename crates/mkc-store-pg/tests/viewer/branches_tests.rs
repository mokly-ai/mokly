//! Branch unions, fallback defaults, deletion observations and keyset boundaries.

use mkc_store_interface::github_refs::Branch;
use mkc_store_interface::publication::PublicationState;

use super::support::{run, time};

#[test]
fn repository_union_default_and_latest_are_project_scoped() {
    run(&mut |q, fixture| {
        q.link_github_project(fixture.project, fixture.repository.id)?;
        for (name, deleted) in [
            ("main", false),
            ("alpha", false),
            ("gone", true),
            ("retained", true),
        ] {
            q.save_github_branch(&Branch {
                repository_id: fixture.repository.id,
                name: name.into(),
                head_sha: (!deleted).then(|| "a".repeat(40)),
                updated_at: time(10),
            })?;
        }
        let ready = fixture.publication(10, "alpha", 1, PublicationState::Ready);
        q.insert_publication(&ready)?;
        q.insert_publication(&fixture.publication(11, "alpha", 2, PublicationState::Failed))?;
        q.insert_publication(&fixture.publication(12, "alpha", 3, PublicationState::Expired))?;
        q.insert_publication(&fixture.publication(13, "retained", 4, PublicationState::Expired))?;
        q.insert_publication(&fixture.publication(14, "zeta", 5, PublicationState::Ready))?;
        let mut foreign = fixture.publication(15, "alpha", 30, PublicationState::Ready);
        foreign.project_id = fixture.other;
        q.insert_publication(&foreign)?;
        let rows = q.viewer_branches(fixture.project, None, 100)?;
        assert_eq!(
            rows.iter().map(|r| r.key.name.as_str()).collect::<Vec<_>>(),
            ["main", "alpha", "retained", "zeta"]
        );
        assert!(rows[0].key.is_default);
        assert!(rows[0].newest_publication.is_none());
        assert_eq!(rows[1].latest_publication_id, Some(ready.id));
        assert_eq!(rows[1].updated_at, time(10));
        assert!(rows[2].latest_publication_id.is_none());
        assert_eq!(rows[2].updated_at, time(10));
        let first = q.viewer_branches(fixture.project, None, 1)?;
        let rest = q.viewer_branches(fixture.project, Some(&first[0].key), 100)?;
        assert_eq!(rest.len(), 3);
        assert_eq!(rest[0].key.name, "alpha");
        assert!(
            q.viewer_branches(fixture.project, Some(&rows[3].key), 100)?
                .is_empty()
        );
        Ok(())
    });
}

#[test]
fn no_repository_uses_newest_ready_default_including_timestamp_ties() {
    run(&mut |q, fixture| {
        assert!(q.viewer_branches(fixture.project, None, 100)?.is_empty());
        q.insert_publication(&fixture.publication(10, "alpha", 2, PublicationState::Ready))?;
        q.insert_publication(&fixture.publication(11, "zeta", 2, PublicationState::Ready))?;
        q.insert_publication(&fixture.publication(12, "beta", 3, PublicationState::Failed))?;
        q.insert_publication(&fixture.publication(13, "expired", 4, PublicationState::Expired))?;
        let rows = q.viewer_branches(fixture.project, None, 100)?;
        assert_eq!(
            rows.iter().map(|r| r.key.name.as_str()).collect::<Vec<_>>(),
            ["zeta", "alpha", "beta", "expired"]
        );
        let mut repository = fixture.repository.clone();
        repository.default_branch.clear();
        repository.active = false;
        q.save_github_repository(&repository)?;
        q.link_github_project(fixture.project, repository.id)?;
        assert_eq!(
            q.viewer_branches(fixture.project, None, 100)?[0].key.name,
            "zeta"
        );
        Ok(())
    });
}
