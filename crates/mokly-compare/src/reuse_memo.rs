//! Memo recording includes cache hits and every transitive CSS or HTML read.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_css::rules::RuleDiff;
use mokly_graph::comparison_proof::ComparisonRead;
use mokly_graph::types::RenderGeneration;
use mokly_model::review_affected::ReviewSide;

use crate::error::Result;
use crate::resource_memo::{ResourceFact, ResourceMemo, ResourceWork};
use crate::reuse_reads::Recorder;

pub(crate) struct RecordingMemo<'a> {
    pub(crate) inner: &'a dyn ResourceMemo,
    pub(crate) before: &'a dyn RenderGeneration,
    pub(crate) after: &'a dyn RenderGeneration,
    pub(crate) recorder: &'a Recorder,
}
impl RecordingMemo<'_> {
    fn record(&self, side: ReviewSide, route: &str) {
        let source = if side == ReviewSide::Before {
            self.before
        } else {
            self.after
        };
        self.recorder
            .record(source, side, ComparisonRead::Resource, route);
    }
    fn pair(&self, before: &str, after: &str) {
        self.record(ReviewSide::Before, before);
        self.record(ReviewSide::After, after);
    }
}
impl ResourceMemo for RecordingMemo<'_> {
    fn fact(&self, side: ReviewSide, route: &str) -> Result<ResourceFact> {
        let value = self.inner.fact(side, route)?;
        self.record(side, route);
        Ok(value)
    }
    fn read(&self, side: ReviewSide, route: &str) -> Result<Option<Arc<[u8]>>> {
        let value = self.inner.read(side, route)?;
        self.record(side, route);
        Ok(value)
    }
    fn fingerprint(
        &self,
        side: ReviewSide,
        route: &str,
        aliases: &BTreeMap<String, String>,
    ) -> Result<Option<String>> {
        let value = self.inner.fingerprint(side, route, aliases)?;
        self.record(side, route);
        Ok(value)
    }
    fn equal(&self, before: &str, after: &str, aliases: &BTreeMap<String, String>) -> Result<bool> {
        let value = self.inner.equal(before, after, aliases)?;
        self.pair(before, after);
        Ok(value)
    }
    fn diff(
        &self,
        before: &str,
        after: &str,
        aliases: &BTreeMap<String, String>,
    ) -> Result<Arc<RuleDiff>> {
        let value = self.inner.diff(before, after, aliases)?;
        self.pair(before, after);
        Ok(value)
    }
    fn inline_diff(&self, before: &[u8], after: &[u8]) -> Result<Arc<RuleDiff>> {
        self.inner.inline_diff(before, after)
    }
    fn owned_diff(&self, before: &[u8], after: &[u8]) -> Result<Arc<RuleDiff>> {
        self.inner.owned_diff(before, after)
    }
    fn work(&self) -> ResourceWork {
        self.inner.work()
    }
}
