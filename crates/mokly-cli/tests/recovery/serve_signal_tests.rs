//! One process-group signal through the shim cancels a hung sidecar and exits zero.

#![cfg(unix)]

use std::path::Path;
use std::process::{Command, Stdio};

use mokly_test_support::consumer;
use mokly_test_support::process::{self, Mokly};
use mokly_test_support::serve::{self, Serve, Stream};
use mokly_test_support::shim;
use regex::Regex;

const HUNG: &str = "process.stderr.write('sidecar-ready:'+process.pid+'\\n');while(true){}";

/// Kills the reported hung sidecar when a failed test leaves it running.
struct Sidecar(Option<u32>);

impl Drop for Sidecar {
    fn drop(&mut self) {
        if let Some(pid) = self.0 {
            let _ = Command::new("kill")
                .args(["-s", "KILL", &pid.to_string()])
                .stderr(Stdio::null())
                .status();
        }
    }
}

fn hung_stage_cancels(stage: &str) {
    let source = if stage == "render" {
        format!(
            "import {{defineScreen}} from '@mokly/mokly';export default defineScreen({{title:'Hang',description:'',relatedDocs:[],props:{{}},render(){{{HUNG}}}}});"
        )
    } else {
        format!("{HUNG}; export const unused=1;")
    };
    let root = consumer::project(&[("specs/hang.mockup.ts", &source)]);
    let installation = tempfile::tempdir().unwrap();
    let installed = shim::install(installation.path(), Path::new(env!("CARGO_BIN_EXE_mokly")));
    let invocation = serve::invocation(&Mokly::node_shim(installed), root.path(), &[]);
    let mut running = Serve::spawn(invocation.process_group());
    if stage == "render" {
        running.ready();
    }
    let ready = Regex::new(r"sidecar-ready:(\d+)").unwrap();
    let stderr = running.wait(Stream::Stderr, &ready);
    let pid: u32 = ready.captures(&stderr).unwrap()[1].parse().unwrap();
    assert!(pid > 0);
    let mut sidecar = Sidecar(Some(pid));
    process::signal_group(running.pid(), "INT");
    let finished = running.finish();
    assert_eq!(finished.code, Some(0), "{}", finished.stderr);
    assert!(!process::alive(pid), "the hung sidecar {pid} still runs");
    sidecar.0 = None;
    assert!(!finished.stderr.contains("[mokly/"), "{}", finished.stderr);
}

#[test]
fn one_process_group_signal_through_the_shim_cancels_a_hung_render_and_exits_zero() {
    hung_stage_cancels("render");
}

#[test]
fn one_process_group_signal_through_the_shim_cancels_a_hung_describe_and_exits_zero() {
    hung_stage_cancels("describe");
}
