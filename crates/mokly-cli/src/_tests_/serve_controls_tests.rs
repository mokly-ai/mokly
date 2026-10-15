//! Cross-platform key events execute each shortcut only on a press.

use crossterm::event::{KeyCode, KeyEvent, KeyEventKind, KeyModifiers};

use super::{Shortcut, shortcut};

#[test]
fn releases_and_repeats_do_not_execute_shortcuts() {
    for (key, action) in [
        ('q', Shortcut::Close),
        ('c', Shortcut::Clear),
        ('o', Shortcut::Open),
        ('h', Shortcut::Help),
        ('r', Shortcut::Rebuild),
    ] {
        assert_eq!(
            shortcut(KeyEvent::new_with_kind(
                KeyCode::Char(key),
                KeyModifiers::NONE,
                KeyEventKind::Press
            )),
            Some(action)
        );
        for kind in [KeyEventKind::Release, KeyEventKind::Repeat] {
            assert_eq!(
                shortcut(KeyEvent::new_with_kind(
                    KeyCode::Char(key),
                    KeyModifiers::NONE,
                    kind
                )),
                None
            );
        }
    }
    assert_eq!(
        shortcut(KeyEvent::new(KeyCode::Char('c'), KeyModifiers::CONTROL)),
        Some(Shortcut::Close)
    );
    assert_eq!(
        shortcut(KeyEvent::new(KeyCode::Char('x'), KeyModifiers::NONE)),
        None
    );
}
