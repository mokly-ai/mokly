//! The protocol document cap policy: exact current caps that never grow from
//! the comparison commit.

use std::collections::{BTreeMap, BTreeSet};

use super::caps::ProtocolCaps;
use super::policy::{PROTOCOL_LIMIT, PROTOCOL_PREFIX, allowed_lines, count_physical_lines};

/// The protocol documents and caps of the working tree and of the
/// comparison commit, by path relative to `docs/protocol/`.
#[derive(Default)]
pub(crate) struct CapInputs {
    /// The working-tree documents and their bytes.
    pub(crate) candidate_documents: BTreeMap<String, Vec<u8>>,
    /// The working-tree cap table.
    pub(crate) candidate_caps: ProtocolCaps,
    /// The documents of the comparison commit.
    pub(crate) baseline_documents: BTreeMap<String, Vec<u8>>,
    /// The caps of the comparison commit, or none to bootstrap them from its
    /// line counts.
    pub(crate) baseline_caps: Option<ProtocolCaps>,
    /// The comparison-commit name of each renamed document.
    pub(crate) predecessors: BTreeMap<String, String>,
}

/// Enforce the current exact caps and prevent policy growth from the
/// comparison commit. The findings are unique and sorted.
pub(crate) fn protocol_cap_findings(inputs: &CapInputs) -> Vec<String> {
    let mut findings = BTreeSet::new();
    for (name, document) in &inputs.candidate_documents {
        let current = count_physical_lines(document);
        let Some(cap) = inputs.candidate_caps.get(name) else {
            let limit = allowed_lines(&format!("{PROTOCOL_PREFIX}{name}"), &inputs.candidate_caps);
            if current > limit {
                findings.insert(format!(
                    "{name}: {current} lines; documents above {PROTOCOL_LIMIT} require an exact reviewed cap"
                ));
            }
            continue;
        };
        if current <= PROTOCOL_LIMIT {
            findings.insert(format!(
                "{name}: {current} lines; remove the cap at or below {PROTOCOL_LIMIT}"
            ));
        } else if current < cap {
            findings.insert(format!("{name}: lower the cap to {current} from {cap}"));
        } else if current > cap {
            findings.insert(format!(
                "{name}: {current} lines exceeds its {cap}-line cap"
            ));
        }
        let predecessor = inputs.predecessors.get(name).unwrap_or(name);
        let Some(previous) = inputs.baseline_documents.get(predecessor) else {
            findings.insert(format!("{name}: new documents cannot add a cap"));
            continue;
        };
        let baseline_cap = match &inputs.baseline_caps {
            Some(caps) => caps.get(predecessor),
            None => bootstrap_cap(previous),
        };
        match baseline_cap {
            None => {
                findings.insert(format!(
                    "{name}: cannot add a cap; predecessor {predecessor} was uncapped"
                ));
            }
            Some(baseline_cap) if cap > baseline_cap => {
                findings.insert(format!(
                    "{name}: cap {cap} exceeds predecessor {predecessor} cap {baseline_cap}"
                ));
            }
            Some(_) => {}
        }
    }
    for name in inputs.candidate_caps.names() {
        if !inputs.candidate_documents.contains_key(name) {
            findings.insert(format!("{name}: stale cap has no protocol document"));
        }
    }
    findings.into_iter().collect()
}

/// A comparison commit without a cap table caps each document over the
/// limit at its line count there.
fn bootstrap_cap(source: &[u8]) -> Option<u64> {
    let lines = count_physical_lines(source);
    (lines > PROTOCOL_LIMIT).then_some(lines)
}

#[cfg(test)]
#[path = "_tests_/protocol_caps_tests.rs"]
mod protocol_caps_tests;
