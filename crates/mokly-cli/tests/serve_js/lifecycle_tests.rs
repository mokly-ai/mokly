//! A running Serve closes its clients and kills busy sidecars before releasing its port.

use std::time::Duration;

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use super::support::Serve;

#[tokio::test]
async fn shutdown_closes_incomplete_clients_and_a_busy_real_sidecar() {
    let source = "import {defineScreen} from '@mokly/mokly'; process.stderr.write('fixture-worker:'+process.pid+'\\n'); export default defineScreen({title:'Home',description:'',relatedDocs:[],props:{},render(){process.stderr.write('fixture-hung:'+process.pid+'\\n'); while(true){} }});";
    let mut serve = Serve::start(source).await;
    let line = serve.wait_line(0, "fixture-hung:").await;
    let pid: i32 = line.trim_start_matches("fixture-hung:").parse().unwrap();
    let mut incomplete = TcpStream::connect(&serve.host).await.unwrap();
    incomplete.write_all(b"GET / HTTP/1.1\r\n").await.unwrap();
    assert!(std::net::TcpListener::bind(&serve.host).is_err());
    let child = serve.child.id().unwrap() as i32;
    // SAFETY: the PID belongs to this fixture's live CLI process.
    assert_eq!(unsafe { libc::kill(child, libc::SIGTERM) }, 0);
    let mut bytes = Vec::new();
    let closed = tokio::time::timeout(Duration::from_secs(30), incomplete.read_to_end(&mut bytes))
        .await
        .unwrap();
    assert!(
        closed.is_ok()
            || matches!(closed, Err(ref error) if error.kind() == std::io::ErrorKind::ConnectionReset)
    );
    released_after_worker(&serve.host, pid).await;
    serve.closed().await;
}

pub(super) fn alive(pid: i32) -> bool {
    #[cfg(target_os = "linux")]
    if let Ok(status) = std::fs::read_to_string(format!("/proc/{pid}/stat"))
        && status
            .rsplit_once(") ")
            .is_some_and(|(_, fields)| fields.starts_with("Z "))
    {
        return false;
    }
    exists(pid)
}

pub(super) fn exists(pid: i32) -> bool {
    // SAFETY: signal zero only probes a sidecar PID recorded by this fixture.
    unsafe { libc::kill(pid, 0) == 0 }
}

pub(super) async fn released_after_worker(host: &str, pid: i32) {
    tokio::time::timeout(Duration::from_secs(30), async {
        loop {
            if let Ok(listener) = std::net::TcpListener::bind(host) {
                assert!(
                    !exists(pid),
                    "listener released while the sidecar remained live"
                );
                drop(listener);
                return;
            }
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap();
}

pub(super) async fn ended(pid: i32) {
    tokio::time::timeout(Duration::from_secs(30), async {
        while alive(pid) {
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap();
}
