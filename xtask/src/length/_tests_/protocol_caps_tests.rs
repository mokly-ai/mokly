//! The cap policy rejects raised, new, stale, and renamed caps.

use std::collections::BTreeMap;

use super::super::caps::ProtocolCaps;
use super::{CapInputs, protocol_cap_findings};

fn lines(count: usize) -> Vec<u8> {
    "line\n".repeat(count).into_bytes()
}

fn documents(entries: &[(&str, usize)]) -> BTreeMap<String, Vec<u8>> {
    entries
        .iter()
        .map(|(name, count)| ((*name).to_owned(), lines(*count)))
        .collect()
}

fn caps(entries: &[(&str, u64)]) -> ProtocolCaps {
    let mut caps = ProtocolCaps::default();
    for (name, cap) in entries {
        caps.insert((*name).to_owned(), *cap);
    }
    caps
}

fn renamed(name: &str, predecessor: &str) -> BTreeMap<String, String> {
    BTreeMap::from([(name.to_owned(), predecessor.to_owned())])
}

#[test]
fn protocol_cap_ratchet_rejects_a_raised_cap() {
    let findings = protocol_cap_findings(&CapInputs {
        candidate_documents: documents(&[("existing.md", 301)]),
        candidate_caps: caps(&[("existing.md", 301)]),
        baseline_documents: documents(&[("existing.md", 300)]),
        baseline_caps: Some(caps(&[("existing.md", 300)])),
        ..CapInputs::default()
    });
    assert!(
        findings.iter().any(|finding| finding
            .contains("existing.md: cap 301 exceeds predecessor existing.md cap 300")),
        "{findings:?}"
    );
}

#[test]
fn protocol_cap_ratchet_rejects_new_caps_and_stale_cap_lines() {
    let findings = protocol_cap_findings(&CapInputs {
        candidate_documents: documents(&[("new.md", 251), ("stale.md", 299)]),
        candidate_caps: caps(&[("new.md", 251), ("stale.md", 300)]),
        baseline_documents: documents(&[("stale.md", 300)]),
        baseline_caps: Some(caps(&[("stale.md", 300)])),
        ..CapInputs::default()
    });
    let joined = findings.join("\n");
    assert!(
        joined.contains("new.md: new documents cannot add a cap"),
        "{joined}"
    );
    assert!(
        joined.contains("stale.md: lower the cap to 299"),
        "{joined}"
    );
}

#[test]
fn protocol_cap_bootstrap_uses_origin_line_counts_and_the_variants_rename() {
    let none: [&str; 0] = [];
    assert_eq!(
        protocol_cap_findings(&CapInputs {
            candidate_documents: documents(&[("mokly-variants.md", 269)]),
            candidate_caps: caps(&[("mokly-variants.md", 269)]),
            baseline_documents: documents(&[("mokly-screen-variants.md", 270)]),
            predecessors: renamed("mokly-variants.md", "mokly-screen-variants.md"),
            ..CapInputs::default()
        }),
        none
    );
    let raised = protocol_cap_findings(&CapInputs {
        candidate_documents: documents(&[("mokly-variants.md", 271)]),
        candidate_caps: caps(&[("mokly-variants.md", 271)]),
        baseline_documents: documents(&[("mokly-screen-variants.md", 270)]),
        predecessors: renamed("mokly-variants.md", "mokly-screen-variants.md"),
        ..CapInputs::default()
    });
    assert!(
        raised.join("\n").contains(
            "mokly-variants.md: cap 271 exceeds predecessor mokly-screen-variants.md cap 270"
        ),
        "{raised:?}"
    );
}

#[test]
fn protocol_cap_rename_cannot_turn_an_uncapped_document_into_a_capped_one() {
    let findings = protocol_cap_findings(&CapInputs {
        candidate_documents: documents(&[("renamed.md", 251)]),
        candidate_caps: caps(&[("renamed.md", 251)]),
        baseline_documents: documents(&[("original.md", 200)]),
        predecessors: renamed("renamed.md", "original.md"),
        ..CapInputs::default()
    });
    assert!(
        findings
            .join("\n")
            .contains("renamed.md: cannot add a cap; predecessor original.md was uncapped"),
        "{findings:?}"
    );
}
