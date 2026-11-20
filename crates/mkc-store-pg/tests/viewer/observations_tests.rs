//! Ready transitions persist immutable counts and indexed current selections.

use chrono::{Duration, Utc};
use mkc_store_interface::publication::PublicationState;
use mkc_store_interface::publication_changes::{Changes, Counts};
use mkc_store_interface::publication_screens::{Scheme, ScreenView, Selection, Viewport};

use super::support::run;

#[test]
fn observations_round_trip_and_survive_expiry() {
    run(&mut |q, fixture| {
        for (index, changes) in [
            Changes::NoComparison,
            Changes::Available(Counts::default()),
            Changes::Available(Counts {
                added: 2,
                changed: 3,
                removed: 4,
            }),
        ]
        .into_iter()
        .enumerate()
        {
            let mut row =
                fixture.publication(index as u128 + 30, "main", 1, PublicationState::Validating);
            row.deadline = Utc::now() + Duration::minutes(15);
            if matches!(changes, Changes::Available(_)) {
                let metadata = row.metadata.as_mut().unwrap();
                metadata.base_ref = Some("main".into());
                metadata.base_sha = Some("f".repeat(40));
            }
            q.insert_publication(&row)?;
            assert_eq!(q.publication(row.id)?.unwrap().changes, None);
            assert!(q.ready_publication(row.id, changes)?);
            assert_eq!(
                q.viewer_publication(fixture.project, row.id)?
                    .unwrap()
                    .publication
                    .changes,
                Some(changes)
            );
            assert!(!q.ready_publication(row.id, Changes::NoComparison)?);
            assert!(q.expire_publication(row.id, Utc::now())?);
            assert!(q.viewer_publication(fixture.project, row.id)?.is_none());
            assert_eq!(q.publication(row.id)?.unwrap().changes, Some(changes));
            assert_eq!(q.publications(fixture.project)?[0].changes, Some(changes));
        }
        Ok(())
    });
}

#[test]
fn screen_selection_uses_one_current_view_and_accepts_long_paths() {
    run(&mut |q, fixture| {
        let mut row = fixture.publication(40, "main", 1, PublicationState::Validating);
        row.deadline = Utc::now() + Duration::minutes(15);
        let metadata = row.metadata.as_mut().unwrap();
        metadata.base_ref = Some("main".into());
        metadata.base_sha = Some("f".repeat(40));
        let long_path = "a".repeat(2048);
        q.insert_publication(&row)?;
        q.insert_publication_screen_views(
            row.id,
            &[
                ScreenView {
                    screen_path: long_path.parse().unwrap(),
                    viewport: Viewport::Desktop,
                    scheme: Scheme::Light,
                },
                ScreenView {
                    screen_path: "Product/Start_1".parse().unwrap(),
                    viewport: Viewport::Desktop,
                    scheme: Scheme::Light,
                },
                ScreenView {
                    screen_path: "Product/Start_1".parse().unwrap(),
                    viewport: Viewport::Mobile,
                    scheme: Scheme::Dark,
                },
            ],
        )?;
        assert!(q.ready_publication(row.id, Changes::Available(Counts::default()))?);
        for (screen, viewport, scheme, expected) in [
            (long_path.as_str(), None, None, true),
            ("Product/Start_1", None, None, true),
            (
                "Product/Start_1",
                Some(Viewport::Mobile),
                Some(Scheme::Dark),
                true,
            ),
            (
                "Product/Start_1",
                Some(Viewport::Mobile),
                Some(Scheme::Light),
                false,
            ),
            ("Product/Start_1", None, Some(Scheme::Light), true),
            ("missing", None, None, false),
        ] {
            let selection = Selection {
                screen_path: screen.parse().unwrap(),
                viewport,
                scheme,
            };
            assert_eq!(
                q.publication_screen_selection(row.id, &selection)?,
                expected
            );
            assert!(!q.publication_screen_selection(fixture.other.0.into(), &selection)?);
        }
        Ok(())
    });
}
