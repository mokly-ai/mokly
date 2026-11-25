//! Periodic socket access checks through a live connection and Postgres.

use chrono::{DateTime, TimeDelta, Utc};
use futures_util::SinkExt;
use mkc_auth::runtime::hash;
use mkc_store_interface::store::Callback;
use tungstenite::Message;

use super::fixtures::{MEMBER_TOKEN, PUBLIC};
use super::harness::{Harness, assert_notice, receive};
use super::route_tests::close_code;

#[tokio::test]
async fn session_recheck_does_not_record_activity() {
    let Some(app) = Harness::start() else {
        return;
    };
    let last_seen = last_seen_at(&app);
    assert_eq!(
        first_recheck(&app, last_seen + TimeDelta::minutes(6)).await,
        None
    );
    assert_eq!(
        last_seen_at(&app),
        last_seen,
        "socket recheck changed session activity"
    );
}

#[tokio::test]
async fn session_recheck_closes_at_the_idle_deadline() {
    let Some(app) = Harness::start() else {
        return;
    };
    let idle_deadline = last_seen_at(&app) + TimeDelta::days(7);
    assert_eq!(
        first_recheck(&app, idle_deadline).await,
        Some(4403),
        "expected the socket to close at the idle deadline"
    );
}

fn last_seen_at(app: &Harness) -> DateTime<Utc> {
    let mut last_seen = None;
    app.store
        .read(&mut Callback(&mut |queries| {
            last_seen = queries
                .session(&hash(MEMBER_TOKEN))?
                .map(|session| session.last_seen_at);
            Ok(())
        }))
        .unwrap();
    last_seen.expect("the member session exists")
}

/// Run the first access check and return its close code, if any.
async fn first_recheck(app: &Harness, wall_time: DateTime<Utc>) -> Option<u16> {
    let mut socket = app.open(PUBLIC, MEMBER_TOKEN).await;
    app.notice(PUBLIC);
    assert_notice(&mut socket).await;
    app.clock.hold_wall_time(wall_time);

    app.clock.advance(25);
    assert_eq!(
        receive(&mut socket).await,
        Message::Ping(Default::default())
    );
    let probe = b"probe".as_slice();
    // The probe flushes the automatic pong before we move the socket clock.
    socket.send(Message::Ping(probe.into())).await.unwrap();
    assert_eq!(receive(&mut socket).await, Message::Pong(probe.into()));

    app.clock.advance(5);
    app.clock.wait_for_scheduled_deadline(50).await;
    app.clock.advance(20);
    // After the second ping, the next access deadline can be scheduled only
    // after the first check has finished. A rejected check sends a close.
    loop {
        tokio::select! {
            () = app.clock.wait_for_scheduled_deadline(60) => return None,
            frame = receive(&mut socket) => match frame {
                Message::Ping(_) => {}
                frame => return Some(close_code(frame)),
            }
        }
    }
}
