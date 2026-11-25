//! Lanes of subprocesses that run at the same time, each with buffered output.

use std::io::{self, Read, Write};
use std::process::Stdio;
use std::sync::{Mutex, PoisonError};
use std::thread;

use crate::error::{Error, ErrorResultExt, Result};

use super::{CommandSpec, build_command};

/// The combined output of one finished command and its outcome.
pub(super) struct Buffered {
    /// Standard output and standard error, in the order the command wrote them.
    pub(super) output: Vec<u8>,
    /// Success, or the failure that the command caused.
    pub(super) result: Result<()>,
}

/// Run each lane's commands in order, with all lanes at the same time.
///
/// A lane stops at its first failed command; the other lanes run to their end.
/// Each finished command writes its display line and its output to `out` as one
/// block, so blocks of different lanes never mix. The first failure in lane
/// order is the result.
pub(super) fn run_lanes(
    lanes: &[Vec<CommandSpec>],
    run: &(dyn Fn(&CommandSpec) -> Buffered + Sync),
    out: &Mutex<dyn Write + Send>,
) -> Result<()> {
    let outcomes = thread::scope(|scope| {
        let handles: Vec<_> = lanes
            .iter()
            .map(|lane| scope.spawn(move || run_lane(lane, run, out)))
            .collect();
        handles
            .into_iter()
            .map(|handle| handle.join().unwrap_or(Err(Error::ConcurrentLanePanicked)))
            .collect::<Vec<_>>()
    });
    outcomes.into_iter().collect()
}

fn run_lane(
    lane: &[CommandSpec],
    run: &(dyn Fn(&CommandSpec) -> Buffered + Sync),
    out: &Mutex<dyn Write + Send>,
) -> Result<()> {
    for command in lane {
        let finished = run(command);
        let mut block = format!("$ {}\n", command.display()).into_bytes();
        block.extend_from_slice(&finished.output);
        if !block.ends_with(b"\n") {
            block.push(b'\n');
        }
        {
            let mut writer = out.lock().unwrap_or_else(PoisonError::into_inner);
            writer
                .write_all(&block)
                .context("write concurrent command output")?;
        }
        finished.result?;
    }
    Ok(())
}

/// Run one command with both output streams sent to one buffer.
pub(super) fn buffered(spec: &CommandSpec) -> Buffered {
    let mut output = Vec::new();
    let result = run_into(spec, &mut output);
    Buffered { output, result }
}

fn run_into(spec: &CommandSpec, output: &mut Vec<u8>) -> Result<()> {
    let (mut reader, writer) = io::pipe().context("create command output pipe")?;
    let mut child = {
        let mut command = build_command(spec);
        command
            .stdin(Stdio::null())
            .stdout(writer.try_clone().context("share command output pipe")?)
            .stderr(writer);
        match command.spawn() {
            Ok(child) => child,
            Err(source) => {
                return Err(Error::CommandStart {
                    command: spec.display(),
                    source,
                });
            }
        }
    };
    let read = reader.read_to_end(output).context("read command output");
    let status = child.wait().context("wait for command")?;
    read?;
    if status.success() {
        return Ok(());
    }
    Err(Error::CommandFailed {
        command: spec.display(),
        status: status.code().map_or_else(
            || "terminated by signal".to_owned(),
            |code| code.to_string(),
        ),
    })
}

#[cfg(test)]
#[path = "../_tests_/concurrent_tests.rs"]
mod concurrent_tests;
