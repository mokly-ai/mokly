//! Per-slot request back-off bounds repeated replacement work under steady pressure.

pub(super) const MEMORY_LIMIT: u64 = 1024 * 1024 * 1024;

pub(super) struct MemorySchedule {
    delay: u64,
    next: u64,
    replacement: bool,
    notified: bool,
}
impl Default for MemorySchedule {
    fn default() -> Self {
        Self {
            delay: 2,
            next: 1,
            replacement: false,
            notified: false,
        }
    }
}
impl MemorySchedule {
    pub(super) fn started(&mut self) {
        self.next = if self.replacement { self.delay } else { 1 };
    }
    pub(super) fn due(&self, requests: u64) -> bool {
        requests >= self.next
    }
    pub(super) fn sample(&mut self, requests: u64, bytes: u64) -> Option<bool> {
        if bytes <= MEMORY_LIMIT {
            self.delay = 2;
            self.next = requests.saturating_add(1);
            self.replacement = false;
            self.notified = false;
            return None;
        }
        if requests == 1 && !self.replacement {
            self.next = 2;
            return None;
        }
        let warn = self.replacement && !self.notified;
        self.notified |= warn;
        self.replacement = true;
        self.delay = (self.delay * 2).min(500);
        self.next = self.delay;
        Some(warn)
    }
}

#[cfg(test)]
#[path = "_tests_/memory_schedule_tests.rs"]
mod memory_schedule_tests;
