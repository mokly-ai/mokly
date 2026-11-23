//! Second-pass faults keep the parser's data, IO, EOF, and interruption precedence.

use std::collections::VecDeque;
use std::io::{self, Cursor, ErrorKind, Read, Seek, SeekFrom};

use mokly_sidecar::bundle_outcomes::EntryFault;

use crate::bundle_codec::{Codec, StoredBundle, StoredKind};
use crate::bundle_fixture::{params, restore};

use super::bundle_codec_tests::file;

enum ReadEvent {
    Bytes(usize),
    Eof,
    Fault(ErrorKind),
}

struct ScriptedInput {
    input: Cursor<Vec<u8>>,
    events: VecDeque<ReadEvent>,
    second_pass: bool,
    interrupted: bool,
    reads_after_interrupted: usize,
}

impl Read for ScriptedInput {
    fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
        if !self.second_pass {
            return self.input.read(buffer);
        }
        if self.interrupted {
            self.reads_after_interrupted += 1;
        }
        match self.events.front_mut() {
            Some(ReadEvent::Bytes(remaining)) => {
                let length = buffer.len().min(*remaining);
                let count = self.input.read(&mut buffer[..length])?;
                *remaining -= count;
                if *remaining == 0 {
                    self.events.pop_front();
                }
                Ok(count)
            }
            Some(ReadEvent::Eof) => {
                self.events.pop_front();
                Ok(0)
            }
            Some(ReadEvent::Fault(kind)) => {
                let kind = *kind;
                self.events.pop_front();
                self.interrupted = kind == ErrorKind::Interrupted;
                Err(kind.into())
            }
            None => self.input.read(buffer),
        }
    }
}

impl Seek for ScriptedInput {
    fn seek(&mut self, position: SeekFrom) -> io::Result<u64> {
        let position = self.input.seek(position)?;
        self.second_pass = true;
        Ok(position)
    }
}

struct Scenario {
    name: &'static str,
    payload: Vec<u8>,
    events: Vec<ReadEvent>,
    expected: Result<&'static str, EntryFault>,
    reads_after_interrupted: usize,
}

#[test]
fn second_pass_faults_preserve_the_original_parser_precedence() {
    let valid = serde_json::to_vec(&StoredBundle {
        kind: StoredKind::Bundles,
        recipe: restore(),
    })
    .unwrap();
    let valid_length = valid.len();
    let mut padded = valid.clone();
    padded.push(b' ');
    let scenarios = [
        Scenario {
            name: "typed data fault before IO during object cleanup",
            payload: br#"{"kind":"unknown"}"#.to_vec(),
            events: vec![ReadEvent::Bytes(17), ReadEvent::Fault(ErrorKind::Other)],
            expected: Err(EntryFault::Damaged),
            reads_after_interrupted: 0,
        },
        Scenario {
            name: "IO during numeric delimiter lookahead",
            payload: b"1 ".to_vec(),
            events: vec![ReadEvent::Bytes(1), ReadEvent::Fault(ErrorKind::Other)],
            expected: Err(EntryFault::Unreadable),
            reads_after_interrupted: 0,
        },
        Scenario {
            name: "transient EOF before IO during numeric delimiter lookahead",
            payload: b"1 ".to_vec(),
            events: vec![
                ReadEvent::Bytes(1),
                ReadEvent::Eof,
                ReadEvent::Fault(ErrorKind::Other),
            ],
            expected: Err(EntryFault::Unreadable),
            reads_after_interrupted: 0,
        },
        Scenario {
            name: "complete recipe before early EOF and unread IO fault",
            payload: padded,
            events: vec![
                ReadEvent::Bytes(valid_length),
                ReadEvent::Eof,
                ReadEvent::Fault(ErrorKind::Other),
            ],
            expected: Ok("quoted \"code\"\n Unicode é"),
            reads_after_interrupted: 0,
        },
        Scenario {
            name: "the parser retries an interruption before valid data",
            payload: valid,
            events: vec![
                ReadEvent::Fault(ErrorKind::Interrupted),
                ReadEvent::Bytes(valid_length),
            ],
            expected: Ok("quoted \"code\"\n Unicode é"),
            reads_after_interrupted: 1,
        },
        Scenario {
            name: "a prior data fault adds no interruption retry",
            payload: b"? ".to_vec(),
            events: vec![
                ReadEvent::Bytes(1),
                ReadEvent::Fault(ErrorKind::Interrupted),
                ReadEvent::Fault(ErrorKind::Other),
            ],
            expected: Err(EntryFault::Damaged),
            reads_after_interrupted: 0,
        },
    ];
    let mut actual = Vec::new();
    let mut expected = Vec::new();
    for scenario in scenarios {
        let bytes = file(1, "current", &scenario.payload);
        let length = bytes.len() as u64;
        let mut input = ScriptedInput {
            input: Cursor::new(bytes),
            events: scenario.events.into(),
            second_pass: false,
            interrupted: false,
            reads_after_interrupted: 0,
        };
        let result = Codec::default().decode(&mut input, length, &params(), "current");
        actual.push((
            scenario.name,
            result.map(|recipe| recipe.compiled().code.clone()),
            input.reads_after_interrupted,
        ));
        expected.push((
            scenario.name,
            scenario.expected.map(str::to_owned),
            scenario.reads_after_interrupted,
        ));
    }
    assert_eq!(actual, expected);
}
