//! Run `mokly serve` with captured output, and wait for a published catalogue.

use std::path::Path;
use std::thread;
use std::time::{Duration, Instant};

use regex::Regex;
use serde_json::Value;

use crate::http::{self, Events};
use crate::process::{Finished, Invocation, Mokly, Running};

/// How long a test waits for an expected Serve state.
const STATE_WAIT: Duration = Duration::from_secs(30);

/// A running `mokly serve --no-watch --port 0 --sidecars 1`.
pub struct Serve {
    running: Option<Running>,
}

/// One captured output stream.
#[derive(Clone, Copy, Debug)]
pub enum Stream {
    /// Standard output.
    Stdout,
    /// Standard error.
    Stderr,
}

/// Prepare Serve in `root` with `extra` arguments and the inherited output mode.
pub fn invocation(mokly: &Mokly, root: &Path, extra: &[&str]) -> Invocation {
    let mut args = vec!["serve", "--no-watch", "--port", "0", "--sidecars", "1"];
    args.extend_from_slice(extra);
    mokly.command(root, &args, "").env_remove("MOKLY_OUTPUT")
}

impl Serve {
    /// Start Serve in `root` with `extra` arguments and the inherited output mode.
    pub fn start(mokly: &Mokly, root: &Path, extra: &[&str]) -> Self {
        Self::spawn(invocation(mokly, root, extra))
    }

    /// Start a prepared Serve invocation.
    pub fn spawn(invocation: Invocation) -> Self {
        Self {
            running: Some(invocation.spawn()),
        }
    }

    /// The process id of the Serve command.
    pub fn pid(&self) -> u32 {
        self.running.as_ref().unwrap().pid()
    }

    /// Wait for Serve to exit by itself.
    pub fn finish(mut self) -> Finished {
        self.running.take().unwrap().wait()
    }

    /// Wait for the listening line and return the origin.
    pub fn ready(&mut self) -> String {
        let listening = Regex::new(r"Mokly listening at (http://127\.0\.0\.1:\d+)").unwrap();
        let line = self.wait(Stream::Stdout, &listening);
        listening.captures(&line).unwrap()[1].to_owned()
    }

    /// Wait until `pattern` matches the text of `stream`, and return that text.
    pub fn wait(&mut self, stream: Stream, pattern: &Regex) -> String {
        self.wait_after(stream, pattern, 0)
    }

    /// Wait until `pattern` matches the text of `stream` after byte `offset`,
    /// and return the whole text.
    pub fn wait_after(&mut self, stream: Stream, pattern: &Regex, offset: usize) -> String {
        let started = Instant::now();
        loop {
            let running = self.running.as_mut().unwrap();
            let text = match stream {
                Stream::Stdout => running.stdout(),
                Stream::Stderr => running.stderr(),
            };
            if text
                .get(offset..)
                .is_some_and(|tail| pattern.is_match(tail))
            {
                return text;
            }
            assert!(
                !running.has_exited(),
                "Serve exited before {pattern}: {}",
                running.stderr()
            );
            assert!(
                started.elapsed() < STATE_WAIT,
                "Serve never printed {pattern}: {text}"
            );
            thread::sleep(Duration::from_millis(10));
        }
    }

    /// Standard error so far.
    pub fn stderr(&self) -> String {
        self.running.as_ref().unwrap().stderr()
    }

    /// Standard output so far.
    pub fn stdout(&self) -> String {
        self.running.as_ref().unwrap().stdout()
    }

    /// Whether Serve has exited.
    pub fn has_exited(&mut self) -> bool {
        self.running.as_mut().unwrap().has_exited()
    }

    /// Stop Serve with SIGINT, check that it exits with code zero, and return its output.
    pub fn close(mut self) -> Finished {
        let running = self.running.take().unwrap();
        running.signal("INT");
        let finished = running.wait();
        assert_eq!(finished.code, Some(0), "{}", finished.stderr);
        finished
    }
}

/// Wait through publication events until `path` has usage and Changes is settled.
///
/// Returns the index and the entry detail of the same revision.
pub fn completed(origin: &str, path: &str) -> (Value, Value) {
    let mut events = Events::open(origin, "/mokly-viewer/events");
    loop {
        let index: Value =
            serde_json::from_slice(&http::get(origin, "/mokly-viewer/index.json").body).unwrap();
        let detail: Value = serde_json::from_slice(
            &http::get(origin, &format!("/mokly-viewer/entries/{path}.json")).body,
        )
        .unwrap();
        let settled = matches!(
            index["changesStatus"].as_str(),
            Some("ready" | "unavailable" | "disabled")
        );
        if detail["revision"] == index["revision"]
            && settled
            && detail["workspace"]["usedBy"].is_array()
        {
            return (index, detail);
        }
        events
            .next_line()
            .expect("the event stream stays open until the catalogue settles");
    }
}
