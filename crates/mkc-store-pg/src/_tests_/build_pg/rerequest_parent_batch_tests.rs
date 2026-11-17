//! Every parent in a Re-run batch is locked before any effect can run.

use mkc_store_interface::store::Callback;
use uuid::Uuid;

use super::lock_support::assert_locked;
use super::rerequest_support::{consume, mark, mark_for_project};
use super::support::{fixture, rc};

#[test]
fn opposite_check_orders_share_the_complete_project_batch() {
    for first_prefix in ["mokly-build:", "mokly-publication:"] {
        let Some(f) = fixture() else { return };
        let second_prefix = if first_prefix == "mokly-build:" {
            "mokly-publication:"
        } else {
            "mokly-build:"
        };
        let mut project = f.project.clone();
        project.id = Uuid::from_u128(f.project.id.0.as_u128() + 1).into();
        project.slug = "second".parse().unwrap();
        project.config_path = "second.config.ts".into();
        f.store
            .transaction(&mut Callback(&mut |q| {
                q.insert_project(&project)?;
                q.link_github_project(project.id, f.repository.id)
            }))
            .unwrap();
        let (one, first_build) = mark_for_project(&f, &project, first_prefix, 1);
        let (two, second_build) = mark(&f, first_prefix, 2);
        let (three, third_build) = mark(&f, second_prefix, 3);
        let (four, fourth_build) = mark_for_project(&f, &project, second_prefix, 4);
        let mut first = f.connection();
        let mut second = f.connection();
        let mut observer = f.connection();
        rc(&mut first, |q| {
            let marks = q.rerequested_github_checks(first_prefix, 100).unwrap();
            assert_eq!(
                marks.iter().map(|mark| mark.id).collect::<Vec<_>>(),
                [one.id, two.id]
            );
            assert!(project.id.0 > f.project.id.0);
            for (table, id) in [
                ("organizations", f.project.organization_id.0),
                ("projects", f.project.id.0),
                ("projects", project.id.0),
                ("github_check_runs", one.id),
                ("github_check_runs", two.id),
            ] {
                assert_locked(&mut observer, table, id);
            }
            rc(&mut second, |other| {
                assert!(
                    other
                        .rerequested_github_checks(second_prefix, 100)
                        .unwrap()
                        .is_empty()
                );
            });
            consume(q, &marks[0], &first_build, f.now).unwrap();
            consume(q, &marks[1], &second_build, f.now).unwrap();
        });
        rc(&mut second, |q| {
            let marks = q.rerequested_github_checks(second_prefix, 100).unwrap();
            assert_eq!(
                marks.iter().map(|mark| mark.id).collect::<Vec<_>>(),
                [three.id, four.id]
            );
            consume(q, &marks[0], &third_build, f.now).unwrap();
            consume(q, &marks[1], &fourth_build, f.now).unwrap();
        });
    }
}
