//! Interactive input and browser opening at the command composition boundary.

use std::io::{self, IsTerminal};
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::time::Duration;

use crossterm::event::{self, Event, KeyCode, KeyModifiers};
use crossterm::terminal;
use mokly_cli::output::{Mode, Style, bounded};
use mokly_cli::redaction::Redactor;
use mokly_cli::serve_output;
use tokio::sync::{mpsc, watch};
use tokio::task::JoinHandle;

use crate::entry::{SystemTerminal, Terminal};

pub(super) fn open(url: &str, style: &Style, redactor: &Redactor) {
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
            SystemTerminal.stderr(&if style.mode == Mode::Plain {
                format!("[mokly/warning] {message}\n")
            } else {
                format!("{}\n", bounded(&format!("  ! {message}"), style.columns))
            });
        }
    }
}

pub(super) fn start(
    enabled: bool,
    stop: watch::Sender<bool>,
    rebuild: mpsc::Sender<()>,
    url: String,
    layout: String,
    style: Style,
    redactor: Arc<Redactor>,
) -> Option<JoinHandle<()>> {
    if !enabled || !io::stdin().is_terminal() {
        return None;
    }
    Some(tokio::task::spawn_blocking(move || {
        let previous = terminal::is_raw_mode_enabled().unwrap_or(false);
        if !previous && terminal::enable_raw_mode().is_err() {
            return;
        }
        let _raw = RawMode { restore: !previous };
        while !*stop.borrow() {
            if !event::poll(Duration::from_millis(100)).unwrap_or(false) {
                continue;
            }
            let Ok(Event::Key(key)) = event::read() else {
                continue;
            };
            match key.code {
                KeyCode::Char('q') => {
                    stop.send_replace(true);
                }
                KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                    stop.send_replace(true);
                }
                KeyCode::Char('c') => SystemTerminal.stdout(&format!("\x1b[2J\x1b[H{layout}")),
                KeyCode::Char('o') => open(&url, &style, &redactor),
                KeyCode::Char('h') => SystemTerminal.stdout(serve_output::shortcuts()),
                KeyCode::Char('r') => {
                    let _ = rebuild.try_send(());
                }
                _ => {}
            }
        }
    }))
}

struct RawMode {
    restore: bool,
}
impl Drop for RawMode {
    fn drop(&mut self) {
        if self.restore {
            let _ = terminal::disable_raw_mode();
        }
    }
}
