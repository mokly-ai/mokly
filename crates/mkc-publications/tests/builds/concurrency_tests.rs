//! Independent replicas compete for durable claims while respecting both limits.

use std::sync::{Arc, Barrier};
use std::thread;

use mkc_publications::build_scheduler::{
    BuildReference, BuildSchedule, BuildScheduler, DatabaseBuildScheduler,
};
use mkc_publications::build_worker::service::BuildClaim;
use mkc_store_interface::build::NewBuild;
use mkc_store_interface::build_state::BuildTrigger;
use mkc_store_interface::github_refs::Branch;

use super::fixtures::Fixture;

#[test]
fn two_replica_workers_start_only_two_live_organization_builds() {
    let Some(fixture) = Fixture::create() else {
        return;
    };
    for index in 0..8 {
        let value = NewBuild {
            id: fixture.runtime.id().into(),
            project_id: fixture.project.id,
            repository_id: fixture.repository.id,
            trigger: BuildTrigger::Request,
            branch: format!("branch-{index}"),
            head_sha: format!("{index:040x}"),
            pull_request: None,
            base_ref: Some("main".into()),
            config_path: fixture.project.config_path.clone(),
            created_at: fixture.runtime.now(),
        };
        fixture.queries(&mut |queries| {
            queries.schedule_build(&value).unwrap();
        });
    }
    let workers = [fixture.claim_worker(4), fixture.claim_worker(4)];
    let barrier = Arc::new(Barrier::new(8));
    let mut claims = thread::scope(|scope| {
        let mut handles = Vec::new();
        for index in 0..8 {
            let barrier = barrier.clone();
            let worker = workers[index % 2].clone();
            handles.push(scope.spawn(move || {
                barrier.wait();
                worker.claim().unwrap()
            }));
        }
        handles
            .into_iter()
            .map(|handle| handle.join().unwrap())
            .collect::<Vec<_>>()
    });
    let started = claims
        .iter()
        .filter(|claim| matches!(claim, BuildClaim::Attempt(_)))
        .count();
    assert!((1..=2).contains(&started));
    if started == 1 {
        claims.push(workers[1].claim().unwrap());
    }
    assert_eq!(
        claims
            .iter()
            .filter(|claim| matches!(claim, BuildClaim::Attempt(_)))
            .count(),
        2
    );
    for worker in &workers {
        assert!(matches!(worker.claim().unwrap(), BuildClaim::Idle));
    }
}

#[test]
fn concurrent_schedulers_create_one_head_and_one_queued_check() {
    let Some(fixture) = Fixture::create() else {
        return;
    };
    let barrier = Arc::new(Barrier::new(6));
    let scheduled = thread::scope(|scope| {
        let handles = (0..6)
            .map(|_| {
                let barrier = barrier.clone();
                let transactions = fixture.transactions.clone();
                let input = BuildSchedule {
                    id: fixture.runtime.id().into(),
                    project_id: fixture.project.id,
                    trigger: BuildTrigger::Push,
                    at: fixture.runtime.now(),
                    rerun_base_ref: None,
                    reference: BuildReference::Branch(Branch {
                        repository_id: fixture.repository.id,
                        name: "main".into(),
                        head_sha: Some("a".repeat(40)),
                        updated_at: fixture.runtime.now(),
                    }),
                };
                scope.spawn(move || {
                    barrier.wait();
                    let mut scheduled = None;
                    let scheduler: &dyn BuildScheduler =
                        &DatabaseBuildScheduler { configured: true };
                    transactions
                        .run(false, &mut |queries| {
                            scheduled = scheduler.schedule(queries, &input)?;
                            Ok(())
                        })
                        .unwrap();
                    scheduled
                })
            })
            .collect::<Vec<_>>();
        handles
            .into_iter()
            .map(|handle| handle.join().unwrap())
            .collect::<Vec<_>>()
    });
    assert_eq!(scheduled.iter().filter(|id| id.is_some()).count(), 1);
    fixture.queries(&mut |queries| {
        assert_eq!(
            queries
                .pending_build_checks(fixture.runtime.now(), 100, Some(fixture.project.id))
                .unwrap()
                .len(),
            1
        );
    });
}
