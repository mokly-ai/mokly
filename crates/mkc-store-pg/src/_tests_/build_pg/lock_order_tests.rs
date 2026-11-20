//! All rows at higher levels are held when a transaction reaches its first blob.

use std::panic::{AssertUnwindSafe, catch_unwind};
use std::thread;

use super::grant_tests::grant;
use super::lock_support::{assert_locked, fail, lock_blob, upload};
use super::support::{attempt, finish, fixture, pid, rc, wait_for_lock};
use diesel::connection::SimpleConnection;
use mkc_store_interface::build_state::{BuildState, BuildTrigger};
use mkc_store_interface::publication::PublicationState;
use mkc_store_interface::store::Callback;

#[test]
fn parent_deletion_locks_parent_build_grant_and_publication_before_blobs() {
    for organization in [false, true] {
        let Some(f) = fixture() else { return };
        let b = f.build("main", 1);
        f.schedule(&b);
        let a = attempt(f.now);
        let g = grant(b.id, &a);
        f.store
            .transaction(&mut Callback(&mut |q| {
                q.start_build(b.id, &a)?.unwrap();
                q.mint_build_grant(&g)?;
                Ok(())
            }))
            .unwrap();
        let (p, blob) = upload(&f, &b, b"parent");
        let mut holder = f.connection();
        let mut deleting = f.connection();
        let mut observer = f.connection();
        let deleting_pid = pid(&mut deleting);
        let project = f.project.clone();
        holder.batch_execute("BEGIN").unwrap();
        lock_blob(&mut holder, &blob);
        let worker = thread::spawn(move || {
            rc(&mut deleting, |q| {
                if organization {
                    q.delete_organization(project.organization_id).unwrap()
                } else {
                    q.delete_project(project.id).unwrap()
                }
            })
        });
        wait_for_lock(&mut observer, deleting_pid);
        let checks = catch_unwind(AssertUnwindSafe(|| {
            if organization {
                assert_locked(&mut observer, "organizations", f.project.organization_id.0);
            }
            assert_locked(&mut observer, "projects", f.project.id.0);
            assert_locked(&mut observer, "builds", b.id.0);
            assert_locked(&mut observer, "build_upload_grants", g.id);
            assert_locked(&mut observer, "publications", p.id.0);
        }));
        holder.batch_execute("COMMIT").unwrap();
        worker.join().unwrap();
        checks.unwrap();
    }
}

#[test]
fn retention_locks_grants_and_every_linked_publication_before_blobs() {
    let Some(f) = fixture() else { return };
    let b = f.build("main", 1);
    f.schedule(&b);
    let a = attempt(f.now);
    let g = grant(b.id, &a);
    f.store
        .transaction(&mut Callback(&mut |q| {
            q.start_build(b.id, &a)?.unwrap();
            q.mint_build_grant(&g)?;
            Ok(())
        }))
        .unwrap();
    let (failed, blob) = upload(&f, &b, b"retention locks");
    fail(&f, &failed);
    let ready = f.publication(&b);
    let mut expired = f.publication(&b);
    expired.state = PublicationState::Expired;
    expired.expired_at = Some(f.now);
    f.store
        .transaction(&mut Callback(&mut |q| {
            q.insert_publication(&ready)?;
            q.insert_publication(&expired)?;
            q.finish_build(
                b.id,
                Some(a.lease_token),
                &finish(f.now, BuildState::Cancelled),
            )?;
            Ok(())
        }))
        .unwrap();
    let mut holder = f.connection();
    let mut pruning = f.connection();
    let mut observer = f.connection();
    let pruning_pid = pid(&mut pruning);
    let now = f.now;
    holder.batch_execute("BEGIN").unwrap();
    lock_blob(&mut holder, &blob);
    let worker = thread::spawn(move || rc(&mut pruning, |q| q.prune_builds(now, 100).unwrap()));
    wait_for_lock(&mut observer, pruning_pid);
    let checks = catch_unwind(AssertUnwindSafe(|| {
        assert_locked(&mut observer, "projects", f.project.id.0);
        assert_locked(&mut observer, "build_upload_grants", g.id);
        for p in [&failed, &ready, &expired] {
            assert_locked(&mut observer, "publications", p.id.0);
        }
    }));
    holder.batch_execute("COMMIT").unwrap();
    assert_eq!(worker.join().unwrap(), 1);
    checks.unwrap();
}

#[test]
fn supersession_locks_all_uploads_before_releasing_the_first_builds_blobs() {
    let Some(f) = fixture() else { return };
    let mut builds = [f.build("main", 1), f.build("main", 2)];
    for b in &mut builds {
        b.trigger = BuildTrigger::Rerun;
        f.schedule(b);
    }
    for b in &builds {
        f.store
            .transaction(&mut Callback(&mut |q| {
                q.start_build(b.id, &attempt(f.now))?;
                Ok(())
            }))
            .unwrap();
    }
    let uploads: Vec<_> = builds
        .iter()
        .enumerate()
        .map(|(i, b)| upload(&f, b, &[i as u8]))
        .collect();
    let mut holder = f.connection();
    let mut scheduling = f.connection();
    let mut observer = f.connection();
    let scheduling_pid = pid(&mut scheduling);
    let newest = f.build("main", 3);
    holder.batch_execute("BEGIN").unwrap();
    for (_, blob) in &uploads {
        lock_blob(&mut holder, blob);
    }
    let worker = thread::spawn(move || rc(&mut scheduling, |q| q.schedule_build(&newest).unwrap()));
    wait_for_lock(&mut observer, scheduling_pid);
    let checks = catch_unwind(AssertUnwindSafe(|| {
        for (p, _) in &uploads {
            assert_locked(&mut observer, "publications", p.id.0);
        }
    }));
    holder.batch_execute("COMMIT").unwrap();
    worker.join().unwrap();
    checks.unwrap();
}
