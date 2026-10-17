//! Event completion precedes other connection cancellation; blocked streams use fake time.

use std::future::pending;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tokio::sync::{oneshot, watch};

use crate::clients::{Clients, HttpClients, Peer};

struct Closed {
    name: &'static str,
    records: Arc<Mutex<Vec<&'static str>>>,
}
impl Drop for Closed {
    fn drop(&mut self) {
        self.records.lock().unwrap().push(self.name);
    }
}

fn attach(
    clients: &mut HttpClients,
    events: bool,
    records: Arc<Mutex<Vec<&'static str>>>,
    release: Option<oneshot::Receiver<()>>,
) -> oneshot::Receiver<()> {
    let (drain, mut draining) = watch::channel(false);
    let (done, completed) = watch::channel(false);
    let (started, starting) = oneshot::channel();
    let record = Closed {
        name: if events { "event" } else { "other" },
        records,
    };
    let task = clients.tasks.spawn(async move {
        let _record = record;
        while !*draining.borrow() {
            draining.changed().await.unwrap();
        }
        let _ = started.send(());
        match release {
            Some(released) => {
                released.await.unwrap();
                done.send_replace(true);
            }
            None => pending::<()>().await,
        }
    });
    clients.peers.insert(
        task.id(),
        Peer {
            events: Arc::new(AtomicBool::new(events)),
            drain,
            done: completed,
        },
    );
    starting
}

#[tokio::test(start_paused = true)]
async fn event_stream_completion_precedes_aborting_the_other_connections() {
    let records = Arc::new(Mutex::new(Vec::new()));
    let mut clients = HttpClients::default();
    let (release, released) = oneshot::channel();
    let started = attach(&mut clients, true, records.clone(), Some(released));
    let _other = attach(&mut clients, false, records.clone(), None);
    let shutdown = tokio::spawn(async move {
        let service: &mut dyn Clients = &mut clients;
        service.shutdown().await;
        clients
    });
    started.await.unwrap();
    assert!(records.lock().unwrap().is_empty());
    release.send(()).unwrap();
    let clients = shutdown.await.unwrap();
    assert_eq!(*records.lock().unwrap(), ["event", "other"]);
    assert!(clients.peers.is_empty());
    assert!(clients.tasks.is_empty());
}

#[tokio::test(start_paused = true)]
async fn blocked_event_streams_share_one_250_millisecond_grace_period() {
    let records = Arc::new(Mutex::new(Vec::new()));
    let mut clients = HttpClients::default();
    let started = attach(&mut clients, true, records.clone(), None);
    let _other = attach(&mut clients, false, records.clone(), None);
    let shutdown = tokio::spawn(async move {
        let service: &mut dyn Clients = &mut clients;
        service.shutdown().await;
        clients
    });
    started.await.unwrap();
    tokio::time::advance(Duration::from_millis(249)).await;
    assert!(!shutdown.is_finished());
    assert!(records.lock().unwrap().is_empty());
    tokio::time::advance(Duration::from_millis(1)).await;
    let clients = shutdown.await.unwrap();
    let mut closed = records.lock().unwrap().clone();
    closed.sort();
    assert_eq!(closed, ["event", "other"]);
    assert!(clients.peers.is_empty());
    assert!(clients.tasks.is_empty());
}
