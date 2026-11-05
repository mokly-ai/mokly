//! Decode shortcut keys while ignoring complete terminal escape sequences.

use crossterm::event::{KeyCode, KeyEvent, KeyEventKind, KeyModifiers};

#[derive(Default)]
enum State {
    #[default]
    Plain,
    Escape,
    Sequence,
    SingleShift,
    Mouse(u8),
    String,
    StringEscape,
    Paste(usize),
}

#[derive(Default)]
/// Shortcut decoding keeps terminal sequences out of the command key stream.
pub(super) struct KeyDecoder {
    state: State,
    sequence: Vec<u8>,
}

impl KeyDecoder {
    /// Consume one byte without waiting for the rest of an escape sequence.
    pub(super) fn push(&mut self, byte: u8) -> Option<KeyEvent> {
        match self.state {
            State::Plain if byte == 0x1b => self.state = State::Escape,
            State::Plain => return ascii(byte, KeyModifiers::NONE),
            State::Escape => {
                self.sequence.clear();
                self.state = match byte {
                    b'[' => State::Sequence,
                    b'O' => State::SingleShift,
                    b']' | b'P' | b'X' | b'^' | b'_' => State::String,
                    _ => State::Plain,
                };
                if matches!(self.state, State::Plain) {
                    return ascii(byte, KeyModifiers::ALT);
                }
            }
            State::Sequence if (0x40..=0x7e).contains(&byte) => {
                self.state = match (byte, self.sequence.as_slice()) {
                    (b'~', b"200") => State::Paste(0),
                    (b'M', b"") => State::Mouse(3),
                    _ => State::Plain,
                };
                if byte == b'u' {
                    return encoded(&self.sequence);
                }
            }
            State::Sequence => {
                if self.sequence.len() < 128 {
                    self.sequence.push(byte);
                }
            }
            State::SingleShift => self.state = State::Plain,
            State::Mouse(1) => self.state = State::Plain,
            State::Mouse(remaining) => self.state = State::Mouse(remaining - 1),
            State::String if byte == 0x07 => self.state = State::Plain,
            State::String if byte == 0x1b => self.state = State::StringEscape,
            State::StringEscape => {
                self.state = if byte == b'\\' {
                    State::Plain
                } else {
                    State::String
                };
            }
            State::Paste(matched) => {
                let end = b"\x1b[201~";
                let matched = if byte == end[matched] {
                    matched + 1
                } else {
                    usize::from(byte == 0x1b)
                };
                self.state = if matched == end.len() {
                    State::Plain
                } else {
                    State::Paste(matched)
                };
            }
            State::String => {}
        }
        None
    }
}

fn ascii(byte: u8, mut modifiers: KeyModifiers) -> Option<KeyEvent> {
    let character = match byte {
        b'\x01'..=b'\x1a' if byte != b'\t' && byte != b'\r' => {
            modifiers |= KeyModifiers::CONTROL;
            char::from(byte - 1 + b'a')
        }
        b'q' | b'c' | b'o' | b'h' | b'r' => char::from(byte),
        _ => return None,
    };
    Some(KeyEvent::new(KeyCode::Char(character), modifiers))
}

fn encoded(sequence: &[u8]) -> Option<KeyEvent> {
    let text = std::str::from_utf8(sequence).ok()?;
    let mut fields = text.split(';');
    let mut codepoints = fields.next()?.split(':');
    let mut character = char::from_u32(codepoints.next()?.parse().ok()?)?;
    let mut flags = fields.next().unwrap_or("1").split(':');
    let mask = flags.next()?.parse::<u8>().ok()?.saturating_sub(1);
    let mut modifiers = KeyModifiers::NONE;
    for (bit, modifier) in [
        (1, KeyModifiers::SHIFT),
        (2, KeyModifiers::ALT),
        (4, KeyModifiers::CONTROL),
        (8, KeyModifiers::SUPER),
        (16, KeyModifiers::HYPER),
        (32, KeyModifiers::META),
    ] {
        if mask & bit != 0 {
            modifiers |= modifier;
        }
    }
    if modifiers.contains(KeyModifiers::SHIFT)
        && let Some(shifted) = codepoints
            .next()
            .and_then(|value| value.parse().ok())
            .and_then(char::from_u32)
    {
        character = shifted;
        modifiers.remove(KeyModifiers::SHIFT);
    }
    let kind = match flags.next().unwrap_or("1") {
        "2" => KeyEventKind::Repeat,
        "3" => KeyEventKind::Release,
        _ => KeyEventKind::Press,
    };
    Some(KeyEvent::new_with_kind(
        KeyCode::Char(character),
        modifiers,
        kind,
    ))
}

#[cfg(test)]
#[path = "_tests_/serve_keyboard_keys_tests.rs"]
mod serve_keyboard_keys_tests;
