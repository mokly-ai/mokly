//! Concurrent completions share one ready transaction and one grant consumption.

use std::thread;

use chrono::Duration;
use mkc_domain::ids::PublicationId;
use mkc_store_interface::publication::PublicationState;
use uuid::Uuid;

use super::super::harness::{Harness, json};
use super::support::{catalogue, complete, plan, send_blobs, start, upload_id};

#[test]
fn overlapping_completions_of_one_upload_repeat_the_same_201() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let attempt = start(&app, &project, 100, Duration::zero(), None);
    let catalogue = catalogue(&attempt, None);
    let planned = json(plan(&app, &attempt, catalogue.plan.clone()), 200);
    let id = upload_id(&planned);
    send_blobs(&app, &attempt, &planned, &catalogue);
    thread::scope(|scope| {
        let requests: Vec<_> = (0..4)
            .map(|_| scope.spawn(|| json(complete(&app, &attempt, id), 201)))
            .collect();
        for request in requests {
            let receipt = request.join().unwrap();
            assert_eq!(receipt["id"], id.to_string());
            assert_eq!(receipt["buildId"], attempt.id.to_string());
        }
    });
    app.queries(&mut |queries| {
        assert_eq!(
            queries
                .build(project.id, attempt.id)
                .unwrap()
                .unwrap()
                .publication_id,
            Some(id)
        );
        assert!(
            queries
                .build_attempt_grant(attempt.id, 1)
                .unwrap()
                .unwrap()
                .consumed_at
                .is_some()
        );
    });
}

#[test]
fn one_grant_can_complete_only_one_of_its_sibling_uploads() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let attempt = start(&app, &project, 110, Duration::zero(), None);
    let catalogue = catalogue(&attempt, None);
    let first = json(plan(&app, &attempt, catalogue.plan.clone()), 200);
    let second = json(plan(&app, &attempt, catalogue.plan.clone()), 200);
    send_blobs(&app, &attempt, &first, &catalogue);
    let ids = [upload_id(&first), upload_id(&second)];
    let winner = thread::scope(|scope| {
        let app = &app;
        let attempt = &attempt;
        let requests: Vec<_> = ids
            .iter()
            .map(|&id| scope.spawn(move || complete(app, attempt, id)))
            .collect();
        let mut winner: Option<PublicationId> = None;
        let mut refused = 0;
        for request in requests {
            let response = request.join().unwrap();
            if response.status() == 201 {
                assert!(winner.is_none());
                winner = Some(
                    json(response, 201)["id"]
                        .as_str()
                        .unwrap()
                        .parse::<Uuid>()
                        .unwrap()
                        .into(),
                );
            } else {
                let value = json(response, 401);
                assert_eq!(value["error"]["reason"], "upload-unauthorized");
                refused += 1;
            }
        }
        assert_eq!(refused, 1);
        winner.unwrap()
    });
    app.queries(&mut |queries| {
        assert_eq!(
            queries
                .build(project.id, attempt.id)
                .unwrap()
                .unwrap()
                .publication_id,
            Some(winner)
        );
        let rows = queries.publications(project.id).unwrap();
        assert_eq!(
            rows.iter()
                .filter(|row| row.state == PublicationState::Ready)
                .count(),
            1
        );
    });
}
