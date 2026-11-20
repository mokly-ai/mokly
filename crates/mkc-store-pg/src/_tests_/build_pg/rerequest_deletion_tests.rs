//! Re-run effects and parent deletion must share a parent-first lock order.

use std::sync::mpsc;
use std::thread;

use diesel::prelude::*;
use diesel::sql_types::Uuid as SqlUuid;
use mkc_store_interface::github_check::GitHubChecks;
use mkc_store_interface::organization::Organizations;
use mkc_store_interface::project::Projects;

use crate::queries::PgQueries;

use super::rerequest_support::{consume, mark};
use super::support::{fixture, pid, rc, wait_for_lock};

fn overlap(prefix: &str, organization: bool, deleting_first: bool) {
    let Some(f) = fixture() else { return };
    let (_, replacement) = mark(&f, prefix, 1);
    let mut first = f.connection();
    let mut second = f.connection();
    let mut observer = f.connection();
    let second_pid = pid(&mut second);
    let project = f.project.id;
    let org = f.project.organization_id;
    let now = f.now;
    let mut worker = None;
    let mut first_error = None;
    let (claimed, received) = mpsc::channel();
    let result = first
        .build_transaction()
        .read_committed()
        .run::<_, diesel::result::Error, _>(|connection| {
            if deleting_first {
                let (table, id) = if organization {
                    ("organizations", org.0)
                } else {
                    ("projects", project.0)
                };
                diesel::sql_query(format!("SELECT id FROM {table} WHERE id = $1 FOR UPDATE"))
                    .bind::<SqlUuid, _>(id)
                    .execute(connection)?;
                let prefix = prefix.to_owned();
                worker = Some(thread::spawn(move || {
                    rc(&mut second, |q| {
                        let checks = q.rerequested_github_checks(&prefix, 100)?;
                        claimed.send(checks.len()).unwrap();
                        for check in checks {
                            consume(q, &check, &replacement, now)?;
                        }
                        Ok(())
                    })
                }));
                let count = received.recv().unwrap();
                let mut q = PgQueries { connection };
                let deleted = if organization {
                    q.delete_organization(org)
                } else {
                    q.delete_project(project)
                };
                if let Err(error) = deleted {
                    first_error = Some(error);
                    return Err(diesel::result::Error::RollbackTransaction);
                }
                assert_eq!(count, 0, "a deleting parent must prevent a Re-run claim");
            } else {
                let mut q = PgQueries { connection };
                let checks = q.rerequested_github_checks(prefix, 100).unwrap();
                assert_eq!(checks.len(), 1);
                worker = Some(thread::spawn(move || {
                    rc(&mut second, |q| {
                        if organization {
                            q.delete_organization(org)
                        } else {
                            q.delete_project(project)
                        }
                    })
                }));
                wait_for_lock(&mut observer, second_pid);
                for check in checks {
                    if let Err(error) = consume(&mut q, &check, &replacement, now) {
                        first_error = Some(error);
                        return Err(diesel::result::Error::RollbackTransaction);
                    }
                }
            }
            Ok(())
        });
    let other = worker.unwrap().join().unwrap();
    assert!(result.is_ok(), "first transaction: {first_error:?}");
    assert!(other.is_ok(), "second transaction: {other:?}");
    rc(&mut observer, |q| {
        assert!(q.project(project).unwrap().is_none());
        assert!(q.rerequested_github_checks(prefix, 100).unwrap().is_empty());
    });
}

#[test]
fn build_rerequest_overlaps_project_deletion() {
    for first in [false, true] {
        overlap("mokly-build:", false, first);
    }
}

#[test]
fn build_rerequest_overlaps_organization_deletion() {
    for first in [false, true] {
        overlap("mokly-build:", true, first);
    }
}

#[test]
fn publication_rerequest_overlaps_project_deletion() {
    for first in [false, true] {
        overlap("mokly-publication:", false, first);
    }
}

#[test]
fn publication_rerequest_overlaps_organization_deletion() {
    for first in [false, true] {
        overlap("mokly-publication:", true, first);
    }
}
