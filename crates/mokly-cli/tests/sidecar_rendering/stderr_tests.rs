//! Build and Serve drain several MiB of sidecar stderr in bounded pieces and reap their children.

#![cfg(unix)]

use std::collections::BTreeSet;
use std::fs;
use std::path::Path;
use std::thread;
use std::time::{Duration, Instant};

use mokly_test_support::consumer;
use mokly_test_support::process::{self, Running};
use mokly_test_support::serve;
use regex::Regex;
use serde_json::json;

use super::support::{mokly, node};
use super::wrapper::{ModuleUrl, wrapped_sidecar};

/// The wrapper that writes 40 lines of 65,537 bytes, one 2 MiB piece, and in Serve a tail.
fn noisy(verb: &str) -> impl Fn(ModuleUrl) -> String {
    let serve = json!(verb == "serve");
    move |module| {
        format!(
            "
import fs from 'node:fs';
import {{Session}} from {session};
fs.appendFileSync('.context/pids',process.pid+'\\n');
process.on('exit',code=>fs.writeFileSync('.context/sidecar-exit',String(code)));
const original=Session.prototype.call;
let written=false;
let tailed=false;
const tail=async()=>{{
  tailed=true;
  await write('\\n'+'S'.repeat(65537)+'\\n');
  await write('T'.repeat(17));
  fs.writeFileSync('.context/stderr-tail-complete','yes');
}};
const write=text=>new Promise((resolve,reject)=>process.stderr.write(text,error=>error?reject(error):resolve()));
Session.prototype.call=async function(request){{
  if(!written && request.method==='processCss'){{
    written=true;
    const forwarded=new Promise((resolve,reject)=>{{
      const watcher=fs.watch('.context',()=>{{
        if(fs.existsSync('.context/stderr-forwarded')){{watcher.close();resolve();}}
      }});
      watcher.on('error',reject);
    }});
    for(let index=0;index<40;index++) await write('L'.repeat(65537)+'\\n');
    await write('R'.repeat(2*1024*1024+1));
    fs.writeFileSync('.context/stderr-complete','yes');
    if({serve}) await tail();
    await write('\\n');
    await forwarded;
  }}
  if({serve} && !tailed && request.method==='shutdown'){{
    await tail();
  }}
  return original.call(this,request);
}};",
            session = module("sidecar/session.js"),
        )
    }
}

fn read(root: &Path, file: &str) -> Option<String> {
    fs::read_to_string(root.join(".context").join(file)).ok()
}

/// Write the acknowledgement once standard error holds the final piece.
fn acknowledge(running: &mut Running, root: &Path, piece: &str) {
    let started = Instant::now();
    while !running.stderr().contains(piece) {
        assert!(!running.has_exited(), "{}", running.stderr());
        assert!(
            started.elapsed() < Duration::from_secs(120),
            "no final piece"
        );
        thread::sleep(Duration::from_millis(10));
    }
    fs::write(root.join(".context/stderr-forwarded"), "yes").unwrap();
}

fn drains_sidecar_stderr(verb: &str) {
    let root = consumer::project(&[
        (
            "mokly.config.json",
            r#"{"postcss":"postcss.mjs","stylesheets":[{"match":"**","stylesheets":["theme.css"]}]}"#,
        ),
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<p>Home</p>",
        ),
        ("theme.css", "p { color: red }"),
        (
            "postcss.mjs",
            "import fs from 'node:fs';fs.appendFileSync('.context/pids',process.pid+'\\n');export default {plugins:[]};",
        ),
    ]);
    let path = root.path();
    let package = wrapped_sidecar(path, &noisy(verb));
    let args: &[&str] = if verb == "build" {
        &[
            "build",
            "--sidecars=1",
            "--no-changes",
            "--out=.context/site",
        ]
    } else {
        &["serve", "--sidecars=1", "--watch", "--port=0"]
    };
    let mut running = mokly()
        .command(path, args, "plain")
        .env("MOKLY_PACKAGE_ROOT", &package)
        .env("MOKLY_NODE_EXECUTABLE", node())
        .spawn();
    let piece = if verb == "serve" {
        format!("{}\n", "T".repeat(17))
    } else {
        "\nR\n".to_owned()
    };
    acknowledge(&mut running, path, &piece);
    if verb == "serve" {
        let origin = listening(&running);
        assert_eq!(read(path, "stderr-complete").as_deref(), Some("yes"));
        assert_eq!(read(path, "stderr-tail-complete").as_deref(), Some("yes"));
        assert_eq!(read(path, "sidecar-exit"), None);
        let (index, _) = serve::completed(&origin, "home");
        assert_eq!(index["changesStatus"], "unavailable");
        let started = Instant::now();
        while !running
            .stderr()
            .lines()
            .any(|line| line.starts_with("[mokly/git-failed]"))
        {
            assert!(
                started.elapsed() < Duration::from_secs(30),
                "no Git diagnostic"
            );
            thread::sleep(Duration::from_millis(10));
        }
        running.signal("INT");
    }
    let result = running.wait();
    assert_eq!(read(path, "stderr-complete").as_deref(), Some("yes"));
    let tail = read(path, "stderr-tail-complete");
    assert_eq!(
        tail.as_deref(),
        if verb == "serve" { Some("yes") } else { None }
    );
    assert_eq!(
        result.code,
        Some(0),
        "{}",
        &result.stderr[result.stderr.len().saturating_sub(2000)..]
    );
    let pieces: Vec<_> = result
        .stderr
        .split('\n')
        .filter(|piece| !piece.is_empty())
        .collect();
    assert!(!pieces.is_empty());
    let git_failure = |piece: &str| piece.starts_with("[mokly/git-failed]");
    assert_eq!(
        pieces.iter().filter(|piece| git_failure(piece)).count(),
        usize::from(verb == "serve")
    );
    for piece in &pieces {
        assert!(
            piece.len() <= 65_536,
            "oversized diagnostic: {}",
            piece.len()
        );
        if !git_failure(piece) {
            let first = piece.as_bytes()[0];
            assert!(b"LRST".contains(&first) && piece.bytes().all(|byte| byte == first));
        }
    }
    let total = |marker: u8| -> usize {
        pieces
            .iter()
            .filter(|piece| piece.as_bytes()[0] == marker)
            .map(|piece| piece.len())
            .sum()
    };
    assert_eq!(total(b'L'), 40 * 65_537);
    assert_eq!(total(b'R'), 2 * 1024 * 1024 + 1);
    assert_eq!(total(b'S'), if verb == "serve" { 65_537 } else { 0 });
    assert_eq!(total(b'T'), if verb == "serve" { 17 } else { 0 });
    let pids: BTreeSet<u32> = read(path, "pids")
        .unwrap()
        .split_whitespace()
        .map(|pid| pid.parse().unwrap())
        .collect();
    assert!(pids.len() >= 2);
    for pid in pids {
        assert!(!process::alive(pid), "{pid} still runs");
    }
}

fn listening(running: &Running) -> String {
    let pattern = Regex::new(r"Mokly listening at (http://127\.0\.0\.1:\d+)").unwrap();
    let started = Instant::now();
    loop {
        if let Some(found) = pattern.captures(&running.stdout()) {
            return found[1].to_owned();
        }
        assert!(
            started.elapsed() < Duration::from_secs(30),
            "Serve never listened"
        );
        thread::sleep(Duration::from_millis(10));
    }
}

#[test]
fn build_drains_several_mib_of_sidecar_stderr_in_bounded_pieces_and_reaps_its_children() {
    drains_sidecar_stderr("build");
}

#[test]
fn serve_drains_several_mib_of_sidecar_stderr_in_bounded_pieces_and_reaps_its_children() {
    drains_sidecar_stderr("serve");
}
