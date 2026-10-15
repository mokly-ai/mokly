//! Pipe tasks bound retained buffers and keep all consumer output off stdout.

use std::io::{Read, Write};
use std::process::{Child, ChildStderr, ChildStdin, ChildStdout};
use std::sync::Arc;
use std::sync::mpsc::{Receiver, SyncSender};

use crate::codec::Decoder;
use crate::error::{Error, InternalError, Result};
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

pub(super) fn read_diagnostics(stderr: ChildStderr, diagnostics: Arc<dyn Diagnostics>) {
    forward_diagnostics(&mut StderrInput(stderr), diagnostics.as_ref());
}

fn forward_diagnostics(reader: &mut dyn DiagnosticInput, diagnostics: &dyn Diagnostics) {
    let mut buffer = [0; 4096];
    let mut carry = Vec::new();
    loop {
        match reader.read(&mut buffer) {
            Ok(0) => break,
            Ok(size) => {
                carry.extend_from_slice(&buffer[..size]);
                while let Some(end) = carry.iter().position(|byte| *byte == b'\n') {
                    diagnostics.emit(&String::from_utf8_lossy(&carry[..end]));
                    carry.drain(..=end);
                }
                while carry.len() > 65_536 {
                    let mut end = 65_536;
                    while end > 0 && carry[end] & 0xc0 == 0x80 {
                        end -= 1;
                    }
                    if end == 0 {
                        end = 65_536;
                    }
                    diagnostics.emit(&String::from_utf8_lossy(&carry[..end]));
                    carry.drain(..end);
                }
            }
            Err(error) => {
                tracing::warn!(%error, "sidecar diagnostic pipe closed");
                break;
            }
        }
    }
    if !carry.is_empty() {
        diagnostics.emit(&String::from_utf8_lossy(&carry));
    }
}

pub(super) struct Reaper(pub(super) Child);

impl Reaper {
    pub(super) fn wait(&mut self) {
        let _ = self.0.wait();
    }
}

impl Drop for Reaper {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

#[cfg(test)]
#[path = "_tests_/process_io_tests.rs"]
mod process_io_tests;
