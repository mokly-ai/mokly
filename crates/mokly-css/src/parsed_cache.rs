//! Content-addressed parsed stylesheet cache with a retained-byte bound.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use mokly_model::material::digest;

use crate::rule_collection::collect;
use crate::rules::{ParsedCss, Rule};

/// Deterministic cache operation counts.
#[derive(Clone, Copy, Debug, Default)]
pub struct ParsedCacheStats {
    /// Charged bytes retained by the cache.
    pub bytes: usize,
    /// Actual stylesheet parses.
    pub parses: usize,
    /// Reused stylesheet parses.
    pub hits: usize,
}

/// Stateful parse boundary. Equal contents at different paths share one parse.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ParsedCssCacheMock))]
pub trait ParsedCssCache: Send + Sync {
    /// Parse or reuse exact UTF-8 stylesheet bytes.
    fn parse(&self, source: &[u8]) -> Arc<ParsedCss>;
    /// Observe byte charges and operation counts.
    fn stats(&self) -> ParsedCacheStats;
}

/// Process-memory LRU. Oversized parsed sheets return without retention.
pub struct MemoryParsedCss {
    bound: usize,
    state: Mutex<State>,
}

#[derive(Default)]
struct State {
    entries: BTreeMap<String, (u128, usize, Arc<ParsedCss>)>,
    order: BTreeMap<u128, String>,
    sequence: u128,
    stats: ParsedCacheStats,
}

impl MemoryParsedCss {
    /// Create an empty cache with an explicit byte bound.
    pub fn new(bound: usize) -> Self {
        Self {
            bound,
            state: Mutex::new(State::default()),
        }
    }
}

impl ParsedCssCache for MemoryParsedCss {
    fn parse(&self, source: &[u8]) -> Arc<ParsedCss> {
        let key = digest(source);
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        state.sequence += 1;
        let sequence = state.sequence;
        if let Some((old, cost, parsed)) = state.entries.remove(&key) {
            state.order.remove(&old);
            state.order.insert(sequence, key.clone());
            state.entries.insert(key, (sequence, cost, parsed.clone()));
            state.stats.hits += 1;
            return parsed;
        }
        let parsed = Arc::new(collect(source));
        state.stats.parses += 1;
        let cost = cost(&parsed);
        if cost <= self.bound {
            while state.stats.bytes > self.bound - cost {
                let Some((_, key)) = state.order.pop_first() else {
                    break;
                };
                if let Some((_, cost, _)) = state.entries.remove(&key) {
                    state.stats.bytes -= cost;
                }
            }
            state.stats.bytes += cost;
            state.order.insert(sequence, key.clone());
            state.entries.insert(key, (sequence, cost, parsed.clone()));
        }
        parsed
    }

    fn stats(&self) -> ParsedCacheStats {
        self.state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .stats
    }
}

fn cost(parsed: &ParsedCss) -> usize {
    let mut bytes = 512;
    match parsed {
        ParsedCss::Failed(cause) => bytes += cause.capacity(),
        ParsedCss::Rules(rules) => {
            bytes += rules.capacity() * std::mem::size_of::<Rule>();
            for rule in rules {
                bytes += rule.declarations.capacity();
                bytes += rule.selectors.capacity() * std::mem::size_of::<String>();
                bytes += rule.selectors.iter().map(String::capacity).sum::<usize>();
                bytes += rule
                    .custom
                    .iter()
                    .chain(&rule.references)
                    .map(|text| text.capacity() + 24)
                    .sum::<usize>();
                bytes += rule
                    .conditions
                    .iter()
                    .map(|condition| {
                        std::mem::size_of_val(&condition.kind) + condition.prelude.capacity() + 64
                    })
                    .sum::<usize>();
                if let Some(at) = &rule.at_rule {
                    bytes += at.name.capacity() + at.prelude.capacity();
                }
            }
        }
    }
    bytes
}
