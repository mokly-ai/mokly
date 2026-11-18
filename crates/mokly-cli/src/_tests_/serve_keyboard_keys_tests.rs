//! Shortcut decoding ignores terminal payloads and retains key modifiers and kinds.

use crossterm::event::{KeyCode, KeyEvent, KeyEventKind, KeyModifiers};

use super::KeyDecoder;

#[test]
fn terminal_sequences_do_not_execute_embedded_shortcuts() {
    for (name, bytes) in [
        ("CSI", b"\x1b[?1qh".as_slice()),
        ("SS3", b"\x1bOqh".as_slice()),
        ("OSC", b"\x1b]qhorc\x07h".as_slice()),
        ("terminated string", b"\x1bPqhorc\x1b\\h".as_slice()),
        ("legacy mouse", b"\x1b[Mqrch".as_slice()),
        ("bracketed paste", b"\x1b[200~qhorc\x1b[201~h".as_slice()),
    ] {
        let mut keys = KeyDecoder::default();
        let actual: Vec<_> = bytes.iter().filter_map(|byte| keys.push(*byte)).collect();
        assert_eq!(
            actual,
            vec![KeyEvent::new(KeyCode::Char('h'), KeyModifiers::NONE)],
            "{name}"
        );
    }
}

#[test]
fn modified_shortcuts_keep_press_repeat_and_release_information() {
    let mut keys = KeyDecoder::default();
    let actual: Vec<_> = b"\x1br\x03\x1b[99;5u\x1b[113;1:2u\x1b[113;1:3u\x1b[113:81;2u"
        .iter()
        .filter_map(|byte| keys.push(*byte))
        .collect();
    assert_eq!(
        actual.last().map(|key| (key.code, key.modifiers)),
        Some((KeyCode::Char('Q'), KeyModifiers::NONE)),
        "a shifted alternate must not become a lowercase shortcut"
    );
    assert_eq!(
        actual,
        vec![
            KeyEvent::new(KeyCode::Char('r'), KeyModifiers::ALT),
            KeyEvent::new(KeyCode::Char('c'), KeyModifiers::CONTROL),
            KeyEvent::new(KeyCode::Char('c'), KeyModifiers::CONTROL),
            KeyEvent::new_with_kind(KeyCode::Char('q'), KeyModifiers::NONE, KeyEventKind::Repeat),
            KeyEvent::new_with_kind(
                KeyCode::Char('q'),
                KeyModifiers::NONE,
                KeyEventKind::Release
            ),
            KeyEvent::new(KeyCode::Char('Q'), KeyModifiers::NONE),
        ]
    );
}
