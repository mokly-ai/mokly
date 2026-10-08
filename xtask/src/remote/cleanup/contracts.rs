//! The single box cleanup owner consumed by remote runner phases.

/// The single owner of warmed boxes that still need cleanup.
pub(in crate::remote) trait BoxCleanup: Send + Sync {
    /// Track a recovered warmup identifier.
    fn track(&self, id: &str);
    /// Preserve a run ID from captured warmup or probe output for this box.
    fn record_run(&self, id: &str, output: &str);
    /// Snapshot boxes that are not stopped or proven completed.
    fn pending(&self) -> Vec<String>;
    /// Stop the requested boxes with normal status and cancellation rules.
    fn stop_boxes(&self, boxes: &[String]) -> usize;
    /// Finish cleanup and report each remaining box once.
    fn finish(&self) -> usize;
}
