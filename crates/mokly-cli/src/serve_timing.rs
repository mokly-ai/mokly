//! The startup timing span writes only process identity and monotonic measurements.

use std::time::Instant;

use crate::entry::Terminal;

pub(super) struct ServeTiming<'a> {
    terminal: &'a dyn Terminal,
    session: Option<String>,
    started: Instant,
    ended: bool,
}
impl<'a> ServeTiming<'a> {
    pub(super) fn new(terminal: &'a dyn Terminal, session: Option<String>) -> Self {
        if let Some(session) = &session {
            terminal.stderr(&format!("[mokly:timing] {{\"schemaVersion\":1,\"session\":\"{session}\",\"pid\":{},\"role\":\"core\",\"stage\":\"serve.ready\",\"id\":1,\"event\":\"start\",\"elapsedMs\":0}}\n", std::process::id()));
        }
        Self {
            terminal,
            session,
            started: Instant::now(),
            ended: false,
        }
    }
    pub(super) fn ready(&mut self) {
        self.end("ok");
    }
    fn end(&mut self, status: &str) {
        if self.ended {
            return;
        }
        self.ended = true;
        if let Some(session) = &self.session {
            let elapsed = self.started.elapsed().as_millis();
            self.terminal.stderr(&format!("[mokly:timing] {{\"schemaVersion\":1,\"session\":\"{session}\",\"pid\":{},\"role\":\"core\",\"stage\":\"serve.ready\",\"id\":1,\"event\":\"end\",\"elapsedMs\":{elapsed},\"durationMs\":{elapsed},\"status\":\"{status}\"}}\n", std::process::id()));
        }
    }
}
impl Drop for ServeTiming<'_> {
    fn drop(&mut self) {
        self.end("error");
    }
}
