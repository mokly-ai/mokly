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

pub(super) fn read_diagnostics(mut stderr: ChildStderr, diagnostics: Arc<dyn Diagnostics>) {
    let mut buffer = [0; 4096];
    loop {
        match stderr.read(&mut buffer) {
            Ok(0) => break,
            Ok(size) => diagnostics.emit(&String::from_utf8_lossy(&buffer[..size])),
            Err(error) => {
                tracing::warn!(%error, "sidecar diagnostic pipe closed");
                break;
            }
        }
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
