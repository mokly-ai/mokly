//! Child-process searches for the deepest input that a probe survives.
//!
//! A stack overflow aborts the whole process, so each depth runs in a fresh
//! copy of this test binary. The child runs one probe on a thread with a fixed
//! stack size and exits successfully only when the probe returns. The
//! `mokly-catalogue` depth tests include this file as well.

use std::env;
use std::process::Command;
use std::thread;

/// Mokly's Tokio, blocking, and render worker threads use 2 MiB stacks.
pub const WORKER_STACK: usize = 2 * 1024 * 1024;

/// The environment variable that carries `{probe}:{depth}` to a child.
const REQUEST: &str = "MOKLY_DEPTH_PROBE";

/// Why the first depth past the limit did not parse.
#[derive(Debug, PartialEq)]
pub enum Failure {
    /// The child aborted because the probe thread overflowed its stack.
    StackOverflow,
    /// The probe returned an unexpected result; the text is the child's stderr.
    Rejected(String),
}

/// The deepest passing depth, and the failure at the next depth.
#[derive(Debug)]
pub struct Limit {
    /// Every depth from 1 to this value parses.
    pub depth: usize,
    /// `None` when the search cap itself parses.
    pub failure: Option<Failure>,
}

/// One named probe: parse `depth` nesting levels and panic on a wrong result.
pub type Probe = (&'static str, fn(usize));

/// Run the requested probe on a fixed worker stack when this is a child.
pub fn run_child(probes: &[Probe]) {
    let Ok(request) = env::var(REQUEST) else {
        return;
    };
    let (name, depth) = request.split_once(':').unwrap();
    let depth: usize = depth.parse().unwrap();
    let probe = probes.iter().find(|probe| probe.0 == name).unwrap().1;
    thread::Builder::new()
        .stack_size(WORKER_STACK)
        .spawn(move || probe(depth))
        .unwrap()
        .join()
        .unwrap();
}

/// Binary-search the deepest passing depth up to `cap` in child processes.
///
/// `child_test` names the ignored test that calls [`run_child`]. A deeper
/// input never uses less stack, so the passing depths form one prefix that
/// starts at depth 1. The search panics when depth 1 does not pass, because a
/// probe that rejects its smallest input has no such prefix.
pub fn search(child_test: &str, name: &str, cap: usize) -> Limit {
    if let Err(failure) = attempt(child_test, name, 1) {
        panic!(
            "{name}: no depth passes: {}",
            describe(&failure, "at depth 1")
        );
    }
    let Err(mut failure) = attempt(child_test, name, cap) else {
        return report(
            name,
            Limit {
                depth: cap,
                failure: None,
            },
        );
    };
    let (mut passing, mut failing) = (1, cap);
    while failing - passing > 1 {
        let middle = passing + (failing - passing) / 2;
        match attempt(child_test, name, middle) {
            Ok(()) => passing = middle,
            Err(next) => (failing, failure) = (middle, next),
        }
    }
    report(
        name,
        Limit {
            depth: passing,
            failure: Some(failure),
        },
    )
}

fn attempt(child_test: &str, name: &str, depth: usize) -> Result<(), Failure> {
    let output = Command::new(env::current_exe().unwrap())
        .args([
            child_test,
            "--exact",
            "--ignored",
            "--nocapture",
            "--test-threads=1",
        ])
        .env(REQUEST, format!("{name}:{depth}"))
        .output()
        .unwrap();
    let stderr = String::from_utf8_lossy(&output.stderr);
    if stderr.contains("has overflowed its stack") {
        return Err(Failure::StackOverflow);
    }
    if !output.status.success() {
        return Err(Failure::Rejected(stderr.into_owned()));
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.contains("1 passed"),
        "the child ran no probe: {stdout}"
    );
    Ok(())
}

fn report(name: &str, limit: Limit) -> Limit {
    let next = match &limit.failure {
        None => "the search cap".to_owned(),
        Some(failure) => describe(failure, "at the next level"),
    };
    eprintln!(
        "{name}: {} levels parse on a {} KiB stack; {next}",
        limit.depth,
        WORKER_STACK / 1024
    );
    limit
}

/// One line that says why a child failed, and where.
fn describe(failure: &Failure, place: &str) -> String {
    match failure {
        Failure::StackOverflow => format!("a stack overflow {place}"),
        Failure::Rejected(stderr) => format!("a rejected result {place}: {}", panic(stderr)),
    }
}

/// The first panic message in a child's stderr and the place it names.
fn panic(stderr: &str) -> String {
    let mut lines = stderr.lines();
    while let Some(line) = lines.next() {
        if let Some((_, place)) = line.split_once("panicked at ") {
            let message = lines.next().unwrap_or_default();
            return format!("{message} ({})", place.trim_end_matches(':'));
        }
    }
    "no panic message".into()
}
