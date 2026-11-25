//! Concurrent lanes overlap, keep each output block whole, and stop a lane at its failure.

use std::sync::Mutex;
use std::sync::mpsc;
use std::time::Duration;

use crate::error::Error;

use super::{Buffered, CommandSpec, run_lanes};

/// Hang guard for a fake command that waits for a command of another lane.
const HANG_GUARD: Duration = Duration::from_secs(60);

fn command(name: &str) -> CommandSpec {
    CommandSpec::new(name)
}

fn passed(output: &str) -> Buffered {
    Buffered {
        output: output.as_bytes().to_vec(),
        result: Ok(()),
    }
}

fn failed(name: &str) -> Buffered {
    Buffered {
        output: format!("{name} broke").into_bytes(),
        result: Err(Error::CommandFailed {
            command: name.to_owned(),
            status: "1".to_owned(),
        }),
    }
}

#[test]
fn lanes_run_at_the_same_time_and_print_each_command_as_one_block() {
    let (first_started, first_seen) = mpsc::channel();
    let (second_started, second_seen) = mpsc::channel();
    let first_started = Mutex::new(first_started);
    let second_started = Mutex::new(second_started);
    let first_seen = Mutex::new(first_seen);
    let second_seen = Mutex::new(second_seen);
    let run = |spec: &CommandSpec| match spec.display().as_str() {
        "prettier" => {
            first_started.lock().unwrap().send(()).unwrap();
            match second_seen.lock().unwrap().recv_timeout(HANG_GUARD) {
                Ok(()) => passed("formatted\nall files\n"),
                Err(_) => failed("prettier"),
            }
        }
        "clippy" => {
            second_started.lock().unwrap().send(()).unwrap();
            match first_seen.lock().unwrap().recv_timeout(HANG_GUARD) {
                Ok(()) => passed("checked"),
                Err(_) => failed("clippy"),
            }
        }
        other => passed(&format!("{other} done\n")),
    };
    let out = Mutex::new(Vec::new());

    let result = run_lanes(
        &[
            vec![command("prettier"), command("eslint")],
            vec![command("clippy")],
        ],
        &run,
        &out,
    );

    assert_eq!(result.map_err(|error| error.to_string()), Ok(()));

    let printed = String::from_utf8(out.into_inner().unwrap()).unwrap();
    let mut started: Vec<_> = printed
        .lines()
        .filter_map(|line| line.strip_prefix("[xtask/command] started: "))
        .collect();
    started.sort_unstable();
    assert_eq!(started, ["clippy", "eslint", "prettier"]);
    let blocks: String = printed
        .split_inclusive('\n')
        .filter(|line| !line.starts_with("[xtask/command] started: "))
        .collect();
    let mut sorted = blocks
        .split("$ ")
        .filter(|block| !block.is_empty())
        .collect::<Vec<_>>();
    sorted.sort_unstable();
    assert_eq!(
        sorted,
        [
            "clippy\nchecked\n",
            "eslint\neslint done\n",
            "prettier\nformatted\nall files\n"
        ]
    );
    assert!(
        printed.find("$ prettier") < printed.find("$ eslint"),
        "a lane prints its commands in order: {printed}"
    );
}

#[test]
fn a_failure_stops_its_lane_while_other_lanes_finish_and_the_first_lane_failure_wins() {
    let ran = Mutex::new(Vec::new());
    let run = |spec: &CommandSpec| {
        let name = spec.display();
        ran.lock().unwrap().push(name.clone());
        if name == "lint" || name == "clippy" {
            failed(&name)
        } else {
            passed("")
        }
    };
    let out = Mutex::new(Vec::new());

    let result = run_lanes(
        &[
            vec![command("lint"), command("ratchets")],
            vec![command("fmt"), command("clippy")],
        ],
        &run,
        &out,
    );

    assert!(matches!(
        result,
        Err(Error::CommandFailed { command, status }) if command == "lint" && status == "1"
    ));
    let mut ran = ran.into_inner().unwrap();
    ran.sort_unstable();
    assert_eq!(ran, ["clippy", "fmt", "lint"]);
    let printed = String::from_utf8(out.into_inner().unwrap()).unwrap();
    assert!(printed.contains("$ lint\nlint broke\n"), "{printed}");
    assert!(printed.contains("$ clippy\nclippy broke\n"), "{printed}");
}
