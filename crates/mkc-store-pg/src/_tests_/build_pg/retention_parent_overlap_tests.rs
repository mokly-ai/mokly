//! Retention cannot lock a newer build ahead of a deleting parent's older build.

use std::thread;

use diesel::prelude::*;
use mkc_store_interface::project::Projects;
use mkc_store_interface::store::Callback;

use crate::queries::PgQueries;

use super::support::{fixture, pid, rc, wait_for_lock};

#[test]
fn deletion_and_pruning_a_supersession_target_share_the_project_lock() {
    let Some(f) = fixture() else { return };
    let older = f.build("main", 1);
    let newer = f.build("main", 2);
    f.schedule(&older);
    f.schedule(&newer);
    f.store
        .transaction(&mut Callback(&mut |q| {
            q.cancel_build(f.project.id, newer.id, f.now)?;
            Ok(())
        }))
        .unwrap();
    let mut deleting = f.connection();
    let mut pruning = f.connection();
    let mut observer = f.connection();
    let pruning_pid = pid(&mut pruning);
    let now = f.now;
    let mut worker = None;
    let mut deletion_error = None;
    let deleted = deleting
        .build_transaction()
        .read_committed()
        .run::<_, diesel::result::Error, _>(|connection| {
            for (table, id) in [("projects", f.project.id.0), ("builds", older.id.0)] {
                diesel::sql_query(format!("SELECT id FROM {table} WHERE id = $1 FOR UPDATE"))
                    .bind::<diesel::sql_types::Uuid, _>(id)
                    .execute(connection)?;
            }
            worker = Some(thread::spawn(move || {
                rc(&mut pruning, |q| q.prune_builds(now, 1))
            }));
            wait_for_lock(&mut observer, pruning_pid);
            match (PgQueries { connection }).delete_project(f.project.id) {
                Ok(()) => Ok(()),
                Err(error) => {
                    deletion_error = Some(error);
                    Err(diesel::result::Error::RollbackTransaction)
                }
            }
        });
    let pruned = worker.unwrap().join().unwrap();
    assert!(deleted.is_ok(), "deletion: {deletion_error:?}");
    assert!(pruned.is_ok(), "retention: {pruned:?}");
    assert_eq!(pruned.unwrap(), 0);
}
