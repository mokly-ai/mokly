//! Serve releases each replaced JavaScript generation, and a killed Serve takes its sidecars.

#![cfg(unix)]

use std::thread;
use std::time::{Duration, Instant};

use mokly_test_support::consumer;
use mokly_test_support::files::write;
use mokly_test_support::http::{self, Events};
use mokly_test_support::process;
use mokly_test_support::process::TreeProcess;
use mokly_test_support::serve::{Serve, Stream};
use regex::Regex;
use serde_json::json;

use super::support::{mokly, node};
use super::wrapper::wrapped_sidecar;

fn screen(label: &str) -> String {
    format!(
        "import React from 'react'; import {{defineScreen}} from '@mokly/mokly';\nexport default defineScreen({{title:'Home',description:'',relatedDocs:[],props:{{}},render:()=>React.createElement('p',null,{})}});",
        json!(label)
    )
}

#[test]
fn serve_releases_each_replaced_javascript_generation_while_it_stays_open() {
    let file = "specs/home.mockup.ts";
    let root = consumer::project(&[(file, &screen("Initial"))]);
    let path = root.path();
    let package = wrapped_sidecar(path, &|module| {
        format!(
            "import {{Session}} from {};
const original = Session.prototype.call;
Session.prototype.call = async function(request) {{
  const result = await original.call(this, request);
  if (request.method === 'bundle') process.stderr.write('lease-bundle '+result.generation+'\\n');
  if (request.method === 'dispose') process.stderr.write('lease-dispose '+request.params.generation+'\\n');
  return result;
}};",
            module("sidecar/session.js")
        )
    });
    let invocation = mokly()
        .command(
            path,
            &["serve", "--watch", "--port=0", "--sidecars=1"],
            "plain",
        )
        .env("MOKLY_PACKAGE_ROOT", &package)
        .env("MOKLY_NODE_EXECUTABLE", node());
    let mut running = Serve::spawn(invocation);
    let origin = running.ready();
    let bundle = Regex::new("lease-bundle ([a-f0-9]{64})").unwrap();
    let initial = bundle
        .captures(&running.wait(Stream::Stderr, &bundle))
        .unwrap()[1]
        .to_owned();
    let mut updates = Events::open(&origin, "/mokly-viewer/events");
    let mut previous = initial;
    for label in ["Updated", "Replaced again"] {
        let before = running.stderr().len();
        assert!(
            !running
                .stderr()
                .contains(&format!("lease-dispose {previous}"))
        );
        write(path, file, screen(label));
        loop {
            let rendered = http::get(&origin, "/static/mokly-generated/home/index.mobile.html");
            assert_eq!(rendered.status, 200);
            if rendered.text().contains(&format!(">{label}<")) {
                break;
            }
            updates.next_line().expect("the event stream stays open");
        }
        let stderr = running.wait_after(Stream::Stderr, &bundle, before);
        let current = bundle.captures(&stderr[before..]).unwrap()[1].to_owned();
        assert_ne!(current, previous);
        let disposed = Regex::new(&format!("lease-dispose {previous}")).unwrap();
        running.wait(Stream::Stderr, &disposed);
        assert!(!running.has_exited());
        previous = current;
    }
    running.close();
}

#[test]
fn killing_the_serve_binary_leaves_no_sidecar_of_its_host() {
    let root = consumer::project(&[(
        "specs/entries.mockup.ts",
        "import React from 'react'; import {defineScreen} from '@mokly/mokly';\nexport const home=defineScreen({path:'home',title:'Home',description:'',relatedDocs:[],render:()=>React.createElement('main',null,'Home')});",
    )]);
    let mut running = Serve::start(&mokly(), root.path(), &[]);
    let origin = running.ready();
    let response = http::get(&origin, "/static/mokly-generated/home/index.mobile.html");
    assert_eq!(response.status, 200);
    assert!(response.text().contains("Home"));
    let sidecar = Regex::new(r"[/\\]sidecar\.js(?: |$)").unwrap();
    let sidecars = Survivors(
        process::descendants(running.pid())
            .into_iter()
            .filter(|child| sidecar.is_match(&child.command))
            .collect(),
    );
    assert!(!sidecars.0.is_empty(), "the host must own a real sidecar");
    process::signal(running.pid(), "KILL");
    let started = Instant::now();
    while sidecars.0.iter().any(|sidecar| process::alive(sidecar.pid)) {
        assert!(
            started.elapsed() < Duration::from_secs(10),
            "a sidecar outlived its killed Serve"
        );
        thread::yield_now();
    }
    let finished = running.finish();
    assert_eq!(finished.code, None);
}

/// Kills the process groups of sidecars that a failed test leaves behind.
struct Survivors(Vec<TreeProcess>);

impl Drop for Survivors {
    fn drop(&mut self) {
        for sidecar in &self.0 {
            if process::alive(sidecar.pid) {
                let _ = std::process::Command::new("kill")
                    .args(["-s", "KILL", "--", &format!("-{}", sidecar.pgid)])
                    .status();
            }
        }
    }
}
