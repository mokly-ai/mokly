//! Interactive input and browser opening at the command composition boundary.

use std::io::{self, IsTerminal};
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

#[cfg(not(unix))]
use crossterm::event::{self, Event};
use crossterm::event::{KeyCode, KeyEvent, KeyEventKind, KeyModifiers};
use crossterm::terminal;
use mokly_cli::output::{Mode, Style, bounded};
use mokly_cli::redaction::Redactor;
use mokly_cli::serve_output;
use tokio::sync::{mpsc, oneshot, watch};
use tokio::task::JoinHandle;

#[cfg(unix)]
use crate::serve_keyboard_unix::UnixKeyboard;
use crate::terminal::Terminal;

/// Poll interval used by the keyboard reader and its shutdown supervisor.
pub(super) const INPUT_INTERVAL: Duration = Duration::from_millis(100);

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

#[cfg_attr(test, unimock::unimock(api = KeyboardInputMock))]
/// Terminal input boundary used by the complete shortcut loop.
pub(super) trait KeyboardInput: Send + Sync {
    /// Return one key, an idle result, or permanent input closure.
    fn read(&self) -> io::Result<Input>;
}

/// One keyboard read, including idle input and permanent input closure.
pub enum Input {
    /// No complete key is ready.
    Pending,
    /// One decoded terminal key.
    Key(KeyEvent),
    /// The terminal no longer accepts input.
    Closed,
}

#[cfg(not(unix))]
struct SystemKeyboard;

#[cfg(not(unix))]
impl KeyboardInput for SystemKeyboard {
    fn read(&self) -> io::Result<Input> {
        if !event::poll(INPUT_INTERVAL)? {
            return Ok(Input::Pending);
        }
        let event = match event::read() {
            Ok(event) => event,
            Err(error) if error.kind() == io::ErrorKind::UnexpectedEof => return Ok(Input::Closed),
            Err(error) => return Err(error),
        };
        Ok(match event {
            Event::Key(key) => Input::Key(key),
            _ => Input::Pending,
        })
    }
}

impl Controls {
    fn read(&self, input: &dyn KeyboardInput) {
        while !*self.stop.borrow() {
            let key = match input.read() {
                Ok(Input::Key(key)) => key,
                Ok(Input::Pending) => continue,
                Ok(Input::Closed) | Err(_) => break,
            };
            if *self.stop.borrow() {
                break;
            }
            match shortcut(key) {
                Some(Shortcut::Close) => {
                    self.stop.send_replace(true);
                }
                Some(Shortcut::Clear) => self
                    .terminal
                    .stdout(&format!("\x1b[2J\x1b[H{}", self.layout)),
                Some(Shortcut::Open) => open(
                    &self.url,
                    &self.style,
                    &self.redactor,
                    self.terminal.as_ref(),
                ),
                Some(Shortcut::Help) => self.terminal.stdout(&serve_output::shortcuts(&self.style)),
                Some(Shortcut::Rebuild) => {
                    let _ = self.rebuild.try_send(());
                }
                None => {}
            }
        }
    }
}

pub(super) fn start(enabled: bool, controls: Controls) -> Option<JoinHandle<()>> {
    if !enabled || !io::stdin().is_terminal() {
        return None;
    }
    #[cfg(unix)]
    let input: Arc<dyn KeyboardInput> = Arc::new(UnixKeyboard::default());
    #[cfg(not(unix))]
    let input: Arc<dyn KeyboardInput> = Arc::new(SystemKeyboard);
    let previous = terminal::is_raw_mode_enabled().unwrap_or(false);
    if !previous && terminal::enable_raw_mode().is_err() {
        return None;
    }
    controls.terminal.raw_mode(true);
    let raw = RawMode {
        restore: !previous,
        terminal: controls.terminal.clone(),
    };
    let mut stopped = controls.stop.subscribe();
    let (finished, mut completed) = oneshot::channel();
    thread::Builder::new()
        .name("mokly-keyboard".into())
        .spawn(move || {
            controls.read(input.as_ref());
            let _ = finished.send(());
        })
        .ok()?;
    Some(tokio::spawn(async move {
        let _raw = raw;
        tokio::select! {
            _ = &mut completed => {},
            () = async {
                while !*stopped.borrow() {
                    if stopped.changed().await.is_err() {
                        break;
                    }
                }
            } => {
                let _ = tokio::time::timeout(INPUT_INTERVAL * 2, &mut completed).await;
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
        if self.restore && io::stdin().is_terminal() {
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
