//! Interactive input and browser opening at the command composition boundary.

use std::io::{self, IsTerminal};
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::time::Duration;

use crossterm::event::{self, Event, KeyCode, KeyEvent, KeyEventKind, KeyModifiers};
use crossterm::terminal;
use mokly_cli::output::{Mode, Style, bounded};
use mokly_cli::redaction::Redactor;
use mokly_cli::serve_output;
use tokio::sync::{mpsc, watch};
use tokio::task::JoinHandle;

use crate::terminal::Terminal;

pub(super) fn open(url: &str, style: &Style, redactor: &Redactor, terminal: &dyn Terminal) {
    #[cfg(target_os = "macos")]
    let mut command = Command::new("open");
    #[cfg(target_os = "linux")]
    let mut command = Command::new("xdg-open");
    #[cfg(windows)]
    let mut command = {
        let mut command = Command::new("cmd.exe");
        command.args(["/d", "/s", "/c", "start", ""]);
        command
    };
    command
        .arg(url)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    match command.spawn() {
        Ok(mut child) => {
            std::thread::spawn(move || {
                let _ = child.wait();
            });
        }
        Err(error) => {
            let message = redactor.safe(&format!("The browser could not open: {error}"));
            terminal.stderr(&if style.mode == Mode::Plain {
                format!("[mokly/warning] {message}\n")
            } else {
                format!("{}\n", bounded(&format!("  ! {message}"), style.columns))
            });
        }
    }
}

pub(super) struct Controls {
    pub(super) stop: watch::Sender<bool>,
    pub(super) rebuild: mpsc::Sender<()>,
    pub(super) url: String,
    pub(super) layout: String,
    pub(super) style: Style,
    pub(super) redactor: Arc<Redactor>,
    pub(super) terminal: Arc<dyn Terminal>,
}

pub(super) fn start(enabled: bool, controls: Controls) -> Option<JoinHandle<()>> {
    let Controls {
        stop,
        rebuild,
        url,
        layout,
        style,
        redactor,
        terminal,
    } = controls;
    if !enabled || !io::stdin().is_terminal() {
        return None;
    }
    Some(tokio::task::spawn_blocking(move || {
        let previous = terminal::is_raw_mode_enabled().unwrap_or(false);
        if !previous && terminal::enable_raw_mode().is_err() {
            return;
        }
        terminal.raw_mode(true);
        let _raw = RawMode {
            restore: !previous,
            terminal: terminal.clone(),
        };
        while !*stop.borrow() {
            if !event::poll(Duration::from_millis(100)).unwrap_or(false) {
                continue;
            }
            let Ok(Event::Key(key)) = event::read() else {
                continue;
            };
            match shortcut(key) {
                Some(Shortcut::Close) => {
                    stop.send_replace(true);
                }
                Some(Shortcut::Clear) => terminal.stdout(&format!("\x1b[2J\x1b[H{layout}")),
                Some(Shortcut::Open) => open(&url, &style, &redactor, terminal.as_ref()),
                Some(Shortcut::Help) => terminal.stdout(&serve_output::shortcuts(&style)),
                Some(Shortcut::Rebuild) => {
                    let _ = rebuild.try_send(());
                }
                None => {}
            }
        }
    }))
}

struct RawMode {
    restore: bool,
    terminal: Arc<dyn Terminal>,
}
impl Drop for RawMode {
    fn drop(&mut self) {
        self.terminal.raw_mode(!self.restore);
        if self.restore {
            let _ = terminal::disable_raw_mode();
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
enum Shortcut {
    Close,
    Clear,
    Open,
    Help,
    Rebuild,
}

fn shortcut(key: KeyEvent) -> Option<Shortcut> {
    if key.kind != KeyEventKind::Press {
        return None;
    }
    match key.code {
        KeyCode::Char('q') => Some(Shortcut::Close),
        KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            Some(Shortcut::Close)
        }
        KeyCode::Char('c') => Some(Shortcut::Clear),
        KeyCode::Char('o') => Some(Shortcut::Open),
        KeyCode::Char('h') => Some(Shortcut::Help),
        KeyCode::Char('r') => Some(Shortcut::Rebuild),
        _ => None,
    }
}

#[cfg(test)]
#[path = "_tests_/serve_controls_tests.rs"]
mod serve_controls_tests;
