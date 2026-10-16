//! Signals before readiness and during configuration preserve ordered cleanup.

use std::fs;
use std::os::unix::process::ExitStatusExt;
use std::time::Duration;

use super::lifecycle_tests::{ended, released_after_worker};
use super::support::{Serve, source, write};

fn signal(serve: &Serve, signal: i32) {
    // SAFETY: the recorded child PID belongs to this test's live binary.
    assert_eq!(
        unsafe { libc::kill(serve.child.id().unwrap() as i32, signal) },
        0
    );
}
fn pid(line: &str, prefix: &str) -> i32 {
    line.trim_start_matches(prefix).parse().unwrap()
}

#[tokio::test]
async fn stopping_a_blocked_startup_never_prints_readiness() {
    let text = format!(
        "{}; process.stderr.write('fixture-startup:'+process.pid+'\\n'); while(true){{}}",
        source("Initial")
    );
    let mut serve = Serve::launch(&text).await;
    let worker = pid(
        &serve.wait_line(0, "fixture-startup:").await,
        "fixture-startup:",
    );
    signal(&serve, libc::SIGTERM);
    serve.closed().await;
    ended(worker).await;
    assert!(
        !serve
            .lines
            .lock()
            .unwrap()
            .iter()
            .any(|line| line.contains("http://") || line.contains("Catalogue ready"))
    );
}
#[tokio::test]
async fn stopping_a_configuration_candidate_ends_its_worker_before_the_listener() {
    let mut serve = Serve::start(&source("Initial")).await;
    serve.ready(0, "Initial").await;
    fs::write(serve.path("blocked.ts"), "process.stderr.write('fixture-candidate:'+process.pid+'\\n'); while(true){}; export default {};").unwrap();
    write(
        &serve.path("mokly.config.json"),
        r#"{"renderer":"blocked.ts"}"#,
    );
    let worker = pid(
        &serve.wait_line(0, "fixture-candidate:").await,
        "fixture-candidate:",
    );
    signal(&serve, libc::SIGTERM);
    released_after_worker(&serve.host, worker).await;
    serve.closed().await;
}
#[tokio::test]
async fn killing_the_binary_also_ends_a_sidecar_blocked_in_a_render() {
    let text = "import {defineScreen} from '@mokly/mokly'; process.stderr.write('fixture-worker:'+process.pid+'\\n'); export default defineScreen({title:'Home',description:'',relatedDocs:[],props:{},render(){process.stderr.write('fixture-blocked:'+process.pid+'\\n'); while(true){} }});";
    let mut serve = Serve::start(text).await;
    let worker = pid(
        &serve.wait_line(0, "fixture-blocked:").await,
        "fixture-blocked:",
    );
    signal(&serve, libc::SIGKILL);
    let status = tokio::time::timeout(Duration::from_secs(30), serve.child.wait())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(status.signal(), Some(libc::SIGKILL));
    ended(worker).await;
    assert!(std::net::TcpListener::bind(&serve.host).is_ok());
}

#[tokio::test]
async fn an_idle_sidecar_ignoring_shutdown_ends_before_the_listener_is_released() {
    let mut serve = Serve::configured("", &|root, package| {
        fs::remove_file(root.join("specs/home.mockup.tsx")).unwrap();
        fs::write(root.join("specs/home.screen.html"), "---\ntitle: Home\n---\n<h1>Home</h1>").unwrap();
        fs::write(root.join("theme.css"), "h1 {color:red}").unwrap();
        fs::write(root.join("postcss.mjs"), "export default {};").unwrap();
        fs::write(root.join("mokly.config.json"), r#"{"postcss":"postcss.mjs","stylesheets":[{"match":"**","stylesheets":["theme.css"]}]}"#).unwrap();
        fs::write(package.join("dist/sidecar.js"), r#"
import fs from 'node:fs';
import {createInterface} from 'node:readline';
const version=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
process.stderr.write('fixture-worker:'+process.pid+'\n');
for await (const line of createInterface({input:process.stdin})) {
  const request=JSON.parse(line);
  if(request.method==='shutdown') {process.stderr.write('fixture-ignore:'+process.pid+'\n');continue;}
  const result=request.method==='hello'?{version}:request.method==='processCss'?{text:request.params.text,dependencies:[]}:null;
  process.stdout.write(JSON.stringify({id:request.id,result})+'\n');
}
"#).unwrap();
    }).await;
    serve.listening().await;
    serve.ready(0, "Home").await;
    serve.key(b"q");
    let worker = pid(
        &serve.wait_line(0, "fixture-ignore:").await,
        "fixture-ignore:",
    );
    released_after_worker(&serve.host, worker).await;
    serve.closed().await;
}
