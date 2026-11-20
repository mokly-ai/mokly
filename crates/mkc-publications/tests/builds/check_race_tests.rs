//! Real Postgres check claims coordinate replicas and preserve concurrent bumps.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::thread;
use std::time::Duration;

use mkc_github_interface::check::{CheckRuns, CheckRunsMock};
use mkc_publications::build_check_worker::{BuildCheckDelivery, BuildChecksWorker};
use mkc_publications::check_worker::PublicationChecks;
use mkc_publications::locations::Locations;
use mkc_store_interface::build::NewBuild;
use mkc_store_interface::build_state::BuildTrigger;
use unimock::{MockFn, Unimock, matching};

use super::fixtures::Fixture;

fn queued(fixture: &Fixture) -> NewBuild {
    let value = NewBuild {
        id: fixture.runtime.id().into(),
        project_id: fixture.project.id,
        repository_id: fixture.repository.id,
        trigger: BuildTrigger::Push,
        branch: "main".into(),
        head_sha: "a".repeat(40),
        pull_request: None,
        base_ref: None,
        config_path: fixture.project.config_path.clone(),
        created_at: fixture.runtime.now(),
    };
    fixture.queries(&mut |queries| queries.schedule_build(&value).unwrap());
    value
}

fn worker(fixture: &Fixture, github: Arc<dyn CheckRuns>) -> Arc<dyn BuildChecksWorker> {
    let locations = Locations {
        app_origin: "https://app.example.com".into(),
        catalogue_domain: "catalogues.example.net".into(),
        catalogue_scheme: "https".into(),
        catalogue_port: None,
    };
    let publications = Arc::new(PublicationChecks {
        transactions: fixture.transactions.clone(),
        files: Arc::new(Unimock::new(())),
        github: github.clone(),
        runtime: fixture.runtime.clone(),
        locations: locations.clone(),
    });
    Arc::new(BuildCheckDelivery {
        transactions: fixture.transactions.clone(),
        github,
        publications,
        runtime: fixture.runtime.clone(),
        locations,
    })
}

#[test]
fn another_replica_skips_a_live_delivery_claim_without_a_provider_request() {
    let Some(fixture) = Fixture::create() else {
        return;
    };
    queued(&fixture);
    let (entered, receiving) = mpsc::channel();
    let (release, released) = mpsc::channel();
    let released = Mutex::new(released);
    let github = Unimock::new(
        CheckRunsMock::upsert
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                entered.send(()).unwrap();
                released
                    .lock()
                    .unwrap()
                    .recv_timeout(Duration::from_secs(10))
                    .unwrap();
                Ok(())
            })),
    );
    let first = worker(&fixture, Arc::new(github.clone()));
    let second = worker(&fixture, Arc::new(Unimock::new(())));
    let project = fixture.project.id;
    let active = first.clone();
    let handle = thread::spawn(move || active.run_batch(Some(project)).unwrap());
    receiving.recv_timeout(Duration::from_secs(10)).unwrap();
    assert_eq!(second.run_batch(Some(project)).unwrap(), 0);
    release.send(()).unwrap();
    assert_eq!(handle.join().unwrap(), 1);
}

#[test]
fn a_state_bump_during_provider_delivery_leaves_its_new_version_due() {
    let Some(fixture) = Fixture::create() else {
        return;
    };
    let build = queued(&fixture);
    let transactions = fixture.transactions.clone();
    let runtime = fixture.runtime.clone();
    let deliveries = Arc::new(AtomicUsize::new(0));
    let count = deliveries.clone();
    let github = Unimock::new(
        CheckRunsMock::upsert
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                if count.fetch_add(1, Ordering::SeqCst) == 0 {
                    transactions
                        .run(false, &mut |queries| {
                            queries.bump_build_check(build.id, runtime.now()).unwrap();
                            Ok(())
                        })
                        .unwrap();
                }
                Ok(())
            }))
            .n_times(2),
    );
    let worker = worker(&fixture, Arc::new(github.clone()));
    assert_eq!(worker.run_batch(Some(fixture.project.id)).unwrap(), 1);
    fixture.queries(&mut |queries| {
        let pending = queries
            .pending_build_checks(fixture.runtime.now(), 100, Some(fixture.project.id))
            .unwrap();
        assert_eq!(pending.len(), 1);
        assert_eq!((pending[0].version, pending[0].delivered_version), (2, 1));
        assert!(pending[0].claim_expires_at.is_none());
    });
    assert_eq!(worker.run_batch(Some(fixture.project.id)).unwrap(), 1);
    assert_eq!(deliveries.load(Ordering::SeqCst), 2);
    fixture.queries(&mut |queries| {
        assert!(
            queries
                .pending_build_checks(fixture.runtime.now(), 100, Some(fixture.project.id))
                .unwrap()
                .is_empty()
        )
    });
}
