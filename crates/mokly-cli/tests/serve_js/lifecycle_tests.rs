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
    serve.closed().await;
    tokio::time::timeout(Duration::from_secs(30), async {
        loop {
            // SAFETY: signal zero probes only this fixture's recorded sidecar PID.
            if unsafe { libc::kill(pid, 0) } != 0 {
                break;
            }
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap();
}
