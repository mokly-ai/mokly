//! Pipe tasks bound retained buffers and keep all consumer output off stdout.

use std::io::{Read, Write};
use std::process::{ChildStderr, ChildStdin, ChildStdout};
use std::sync::Arc;
use std::sync::mpsc::{Receiver, SyncSender};

use crate::codec::Decoder;
use crate::error::{Error, InternalError, Result};
use crate::postcss_phase::PhaseState;
use crate::wire::Frame;
use crate::workers::Diagnostics;

pub(super) fn read_frames(mut stdout: ChildStdout, sender: SyncSender<Result<Frame>>) {
    let mut decoder = Decoder::default();
    let mut buffer = [0; 16_384];
    loop {
        match stdout.read(&mut buffer) {
            Ok(0) => {
                let result = match decoder.finish() {
                    Ok(()) => Err(Error::Crashed),
                    Err(error) => Err(error),
                };
                let _ = sender.send(result);
                break;
            }
            Ok(size) => match decoder.push(&buffer[..size]) {
                Ok(frames) => {
                    for frame in frames {
                        if sender.send(Ok(frame)).is_err() {
                            return;
                        }
                    }
                }
                Err(error) => {
                    let _ = sender.send(Err(error));
                    break;
                }
            },
            Err(source) => {
                let _ = sender.send(Err(InternalError::Io { source }.into()));
                break;
            }
        }
    }
}

pub(super) fn write_frames(mut stdin: ChildStdin, receiver: Receiver<Vec<u8>>) {
    for frame in receiver {
        if stdin.write_all(&frame).is_err() {
            break;
        }
    }
}

#[cfg_attr(test, unimock::unimock(api = DiagnosticInputMock))]
pub(super) trait DiagnosticInput {
    fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize>;
}

struct StderrInput(ChildStderr);

impl DiagnosticInput for StderrInput {
    fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
        self.0.read(buffer)
    }
}

pub(super) fn read_diagnostics(
    stderr: ChildStderr,
    diagnostics: Arc<dyn Diagnostics>,
    timings: bool,
    phases: PhaseState,
) {
    forward_diagnostics(
        &mut StderrInput(stderr),
        diagnostics.as_ref(),
        timings,
        &phases,
    );
}

fn forward_diagnostics(
    reader: &mut dyn DiagnosticInput,
    diagnostics: &dyn Diagnostics,
    timings: bool,
    phases: &PhaseState,
) {
    let mut buffer = [0; 4096];
    let mut carry = Vec::new();
    loop {
        match reader.read(&mut buffer) {
            Ok(0) => break,
            Ok(size) => {
                carry.extend_from_slice(&buffer[..size]);
                loop {
                    let newline = carry.iter().position(|byte| *byte == b'\n');
                    if let Some(end) = newline.filter(|end| *end <= 65_536) {
                        forward_piece(
                            &String::from_utf8_lossy(&carry[..end]),
                            diagnostics,
                            timings,
                            phases,
                        );
                        carry.drain(..=end);
                    } else if carry.len() > 65_536 {
                        let mut end = 65_536;
                        while end > 0 && carry[end] & 0xc0 == 0x80 {
                            end -= 1;
                        }
                        if end == 0 {
                            end = 65_536;
                        }
                        forward_piece(
                            &String::from_utf8_lossy(&carry[..end]),
                            diagnostics,
                            false,
                            phases,
                        );
                        carry.drain(..end);
                    } else {
                        break;
                    }
                }
            }
            Err(error) => {
                tracing::warn!(%error, "sidecar diagnostic pipe closed");
                break;
            }
        }
    }
    if !carry.is_empty() {
        forward_piece(
            &String::from_utf8_lossy(&carry),
            diagnostics,
            timings,
            phases,
        );
    }
}

fn forward_piece(text: &str, diagnostics: &dyn Diagnostics, timings: bool, phases: &PhaseState) {
    if phases.record(text) {
        return;
    }
    if timings
        && let Some(payload) = text.strip_prefix("[mokly:timing] ")
        && let Ok(record) = serde_json::from_str::<serde_json::Value>(payload)
        && record["schemaVersion"] == 1
        && record["role"] == "sidecar"
        && record["pid"].as_u64().is_some()
        && record["id"].as_u64().is_some()
        && record["session"]
            .as_str()
            .is_some_and(|session| !session.is_empty())
        && record["stage"].is_string()
        && record["elapsedMs"].is_number()
        && matches!(record["event"].as_str(), Some("start" | "end" | "counts"))
    {
        diagnostics.timing(text);
    } else {
        diagnostics.emit(text);
    }
}

#[cfg(test)]
#[path = "_tests_/process_io_tests.rs"]
mod process_io_tests;
