//! History preserves failures while exact reads conceal expired and foreign IDs.

use mkc_store_interface::build::NewBuild;
use mkc_store_interface::build_state::BuildTrigger;
use mkc_store_interface::publication::{PublicationFailure, PublicationState};
use mkc_store_interface::viewer::{HistoryFilter, PublicationKey};
use uuid::Uuid;

use super::support::{run, time};

#[test]
fn history_ties_filters_and_retained_reads_obey_the_contract() {
    run(&mut |q, fixture| {
        let ready = fixture.publication(10, "main", 1, PublicationState::Ready);
        let failed = fixture.publication(11, "feature", 2, PublicationState::Failed);
        let expired = fixture.publication(12, "feature", 2, PublicationState::Expired);
        let mut unknown = fixture.publication(13, "feature", 3, PublicationState::Failed);
        unknown.metadata = None;
        for row in [&ready, &failed, &expired, &unknown] {
            q.insert_publication(row)?;
        }
        let all = q.viewer_publications(fixture.project, &HistoryFilter::default(), None, 100)?;
        assert_eq!(
            all.iter().map(|r| r.publication.id).collect::<Vec<_>>(),
            [unknown.id, expired.id, failed.id, ready.id]
        );
        assert_eq!(
            all[2].publication.failure,
            Some(PublicationFailure::InvalidBundle)
        );
        let after = PublicationKey {
            created_at: all[1].publication.created_at,
            id: all[1].publication.id,
        };
        let rest = q.viewer_publications(
            fixture.project,
            &HistoryFilter::default(),
            Some(&after),
            100,
        )?;
        assert_eq!(
            rest.iter().map(|r| r.publication.id).collect::<Vec<_>>(),
            [failed.id, ready.id]
        );
        for filter in [
            HistoryFilter {
                branch: Some("feature".into()),
                pull_request: None,
            },
            HistoryFilter {
                branch: Some("feature".into()),
                pull_request: Some(7),
            },
        ] {
            assert_eq!(
                q.viewer_publications(fixture.project, &filter, None, 100)?
                    .len(),
                2
            );
        }
        assert!(
            q.viewer_publications(
                fixture.project,
                &HistoryFilter {
                    branch: Some("feature".into()),
                    pull_request: Some(9)
                },
                None,
                100
            )?
            .is_empty()
        );
        assert_eq!(
            q.viewer_publication(fixture.project, failed.id)?
                .unwrap()
                .publication
                .failure,
            Some(PublicationFailure::InvalidBundle)
        );
        assert!(q.viewer_publication(fixture.project, expired.id)?.is_none());
        assert!(q.viewer_publication(fixture.other, ready.id)?.is_none());
        assert!(
            q.viewer_publication(fixture.project, Uuid::nil().into())?
                .is_none()
        );
        assert!(q.delete_failed_publication(unknown.id, time(100))?);
        assert!(q.viewer_publication(fixture.project, unknown.id)?.is_none());
        let deleted_anchor = PublicationKey {
            created_at: unknown.created_at,
            id: unknown.id,
        };
        assert_eq!(
            q.viewer_publications(
                fixture.project,
                &HistoryFilter::default(),
                Some(&deleted_anchor),
                100
            )?
            .len(),
            3
        );
        Ok(())
    });
}

#[test]
fn replay_attempts_are_excluded_before_combined_history_pagination() {
    run(&mut |q, fixture| {
        q.link_github_project(fixture.project, fixture.repository.id)?;
        let ready = fixture.publication(10, "feature", 1, PublicationState::Ready);
        let expired = fixture.publication(11, "feature", 2, PublicationState::Expired);
        let failed = fixture.publication(12, "feature", 3, PublicationState::Failed);
        let mut replay = fixture.publication(13, "feature", 5, PublicationState::Failed);
        replay.metadata = ready.metadata.clone();
        replay.failure = Some(PublicationFailure::Superseded);
        for publication in [&ready, &expired, &failed, &replay] {
            q.insert_publication(publication)?;
        }
        let build = NewBuild {
            id: Uuid::from_u128(fixture.project.0.as_u128() + 14).into(),
            project_id: fixture.project,
            repository_id: fixture.repository.id,
            trigger: BuildTrigger::Request,
            branch: "feature".into(),
            head_sha: "b".repeat(40),
            pull_request: Some(7),
            base_ref: None,
            config_path: "mokly.config.ts".into(),
            created_at: time(4),
        };
        q.schedule_build(&build)?;
        let filter = HistoryFilter {
            branch: Some("feature".into()),
            pull_request: Some(7),
        };
        let legacy = q.viewer_publications(fixture.project, &filter, None, 100)?;
        assert_eq!(
            legacy
                .iter()
                .map(|row| row.publication.id)
                .collect::<Vec<_>>(),
            [replay.id, failed.id, expired.id, ready.id]
        );
        assert_eq!(
            q.viewer_publication(fixture.project, replay.id)?
                .unwrap()
                .publication
                .failure,
            Some(PublicationFailure::Superseded)
        );
        for (include_builds, expected) in [
            (
                true,
                vec![build.id.0, failed.id.0, expired.id.0, ready.id.0],
            ),
            (false, vec![failed.id.0, expired.id.0, ready.id.0]),
        ] {
            let first = q.build_history(fixture.project, &filter, None, 2, include_builds)?;
            assert_eq!(
                first.iter().map(|entry| entry.key().id).collect::<Vec<_>>(),
                expected[..2],
                "history must exclude replay attempts before pagination"
            );
            let after = first.last().unwrap().key();
            let rest =
                q.build_history(fixture.project, &filter, Some(&after), 2, include_builds)?;
            assert_eq!(
                rest.iter().map(|entry| entry.key().id).collect::<Vec<_>>(),
                expected[2..]
            );
            let after = rest.last().unwrap().key();
            assert_eq!(
                q.build_history(fixture.project, &filter, Some(&after), 2, include_builds)?
                    .len(),
                0
            );
        }
        Ok(())
    });
}
