//! Scheduling supersession and project/reference isolation.

use mkc_store_interface::build_state::{BuildState, BuildTrigger};
use mkc_store_interface::store::Callback;
use uuid::Uuid;

use super::support::{attempt, fixture};

#[test]
fn newer_heads_supersede_queued_and_uncommitted_running_on_the_same_reference() {
    let Some(f) = fixture() else {
        return;
    };
    let old = f.build("topic", 1);
    f.schedule(&old);
    let a = attempt(f.now);
    f.store
        .transaction(&mut Callback(&mut |q| {
            assert!(q.start_build(old.id, &a)?.is_some());
            Ok(())
        }))
        .unwrap();
    let queued = f.build("topic", 2);
    let mut queued = queued;
    queued.trigger = BuildTrigger::Rerun;
    f.schedule(&queued);
    let other = f.build("other", 3);
    f.schedule(&other);
    let mut pr = f.build("topic", 4);
    pr.pull_request = Some(7);
    f.schedule(&pr);
    let new = f.build("topic", 5);
    f.schedule(&new);
    f.store
        .read(&mut Callback(&mut |q| {
            for id in [old.id, queued.id] {
                let b = q.build(f.project.id, id)?.unwrap();
                assert_eq!(b.state, BuildState::Superseded);
                assert_eq!(b.superseded_by, Some(new.id));
                assert!(b.lease_token.is_none());
                assert!(b.log_complete);
                assert!(b.finished_at.is_some());
            }
            assert_eq!(
                q.build(f.project.id, other.id)?.unwrap().state,
                BuildState::Queued
            );
            assert_eq!(
                q.build(f.project.id, pr.id)?.unwrap().state,
                BuildState::Queued
            );
            assert_eq!(
                q.active_build(f.project.id, &new.head_sha)?.unwrap().id,
                new.id
            );
            assert!(q.build(Uuid::now_v7().into(), new.id)?.is_none());
            let checks = q.pending_build_checks(f.now, 100, None)?;
            assert_eq!(
                checks
                    .iter()
                    .find(|c| c.build_id == old.id)
                    .unwrap()
                    .version,
                3
            );
            Ok(())
        }))
        .unwrap();
}

#[test]
fn pull_request_reference_uses_number_and_rerun_supersedes_nothing() {
    let Some(f) = fixture() else {
        return;
    };
    let mut old = f.build("old-branch", 1);
    old.pull_request = Some(7);
    f.schedule(&old);
    let mut new = f.build("renamed-branch", 2);
    new.pull_request = Some(7);
    f.schedule(&new);
    let mut rerun = f.build("renamed-branch", 3);
    rerun.pull_request = Some(7);
    rerun.trigger = BuildTrigger::Rerun;
    f.schedule(&rerun);
    f.store
        .read(&mut Callback(&mut |q| {
            assert_eq!(
                q.build(f.project.id, old.id)?.unwrap().superseded_by,
                Some(new.id)
            );
            assert_eq!(
                q.build(f.project.id, new.id)?.unwrap().state,
                BuildState::Queued
            );
            assert_eq!(
                q.github_repository_projects(f.repository.id)?[0].id,
                f.project.id
            );
            assert!(
                q.github_repository_projects(Uuid::now_v7().into())?
                    .is_empty()
            );
            assert!(!q.project(f.project.id)?.unwrap().automatic_builds);
            Ok(())
        }))
        .unwrap();
}
