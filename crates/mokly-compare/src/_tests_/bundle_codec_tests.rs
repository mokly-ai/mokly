//! Foreign headers, typed damage, and both independent encoded byte limits.

use std::io::{self, Cursor, Read, Seek, SeekFrom};

use mokly_sidecar::bundle_outcomes::EntryFault;
use mokly_sidecar::reusable_recipe::disk_seed_request;
use sha2::{Digest, Sha256};

use crate::bundle_codec::{Codec, HEADER_BYTES, Header, StoredBundle, StoredKind, hex};
use crate::bundle_fixture::{params, recipe, restore};

fn file(format: u64, version: &str, payload: &[u8]) -> Vec<u8> {
    let header = Header {
        format_version: format,
        mokly_version: version.into(),
        payload_digest: hex(&Sha256::digest(payload)),
    };
    let mut bytes = serde_json::to_vec(&header).unwrap();
    bytes.push(b'\n');
    bytes.extend_from_slice(payload);
    bytes
}

struct ObservedInput {
    input: Cursor<Vec<u8>>,
    payload: usize,
    reads: usize,
    payload_reads: usize,
}

impl Read for ObservedInput {
    fn read(&mut self, bytes: &mut [u8]) -> io::Result<usize> {
        self.reads += 1;
        if self.input.position() as usize >= self.payload {
            self.payload_reads += 1;
            return Err(io::Error::other("payload read forbidden"));
        }
        self.input.read(bytes)
    }
}

impl Seek for ObservedInput {
    fn seek(&mut self, position: SeekFrom) -> io::Result<u64> {
        self.input.seek(position)
    }
}

#[test]
fn foreign_versions_reject_before_any_payload_read_or_parse() {
    for (format, version) in [(2, "current"), (1, "foreign")] {
        let bytes = file(format, version, b"invalid payload");
        let payload = bytes.iter().position(|byte| *byte == b'\n').unwrap() + 1;
        let length = bytes.len() as u64;
        let mut input = ObservedInput {
            input: Cursor::new(bytes),
            payload,
            reads: 0,
            payload_reads: 0,
        };
        let result = Codec::default().decode(&mut input, length, &params(), "current");
        assert_eq!(
            result.err(),
            Some(EntryFault::VersionMismatch),
            "format {format}, version {version}"
        );
        assert_eq!(input.payload_reads, 0);
    }
}

#[test]
fn damage_wrong_settings_and_incomplete_evidence_never_supply_a_disk_seed() {
    let mut other = restore();
    other.params.source_root = "/another-repository".into();
    let mut incomplete = restore();
    incomplete.compiled.reuse_evidence.complete = false;
    let mut unverified = restore();
    unverified.compiled.reuse_evidence.durable = false;
    let unverified = serde_json::to_vec(&StoredBundle {
        kind: StoredKind::Bundles,
        recipe: unverified,
    })
    .unwrap();
    let legacy = String::from_utf8(
        serde_json::to_vec(&StoredBundle {
            kind: StoredKind::Bundles,
            recipe: restore(),
        })
        .unwrap(),
    )
    .unwrap()
    .replace("\"durable\":true,", "")
    .into_bytes();
    let wrong_settings = serde_json::to_vec(&StoredBundle {
        kind: StoredKind::Bundles,
        recipe: other,
    })
    .unwrap();
    let incomplete = serde_json::to_vec(&StoredBundle {
        kind: StoredKind::Bundles,
        recipe: incomplete,
    })
    .unwrap();
    let wrong_kind = serde_json::to_vec(&StoredBundle {
        kind: StoredKind::Sources,
        recipe: restore(),
    })
    .unwrap();
    let complete = serde_json::to_vec(&StoredBundle {
        kind: StoredKind::Bundles,
        recipe: restore(),
    })
    .unwrap();
    let mut bad_digest = file(1, "current", &complete);
    bad_digest.push(b' ');
    for (name, bytes, fault) in [
        ("digest", bad_digest, EntryFault::Damaged),
        (
            "unverified capture",
            file(1, "current", &unverified),
            EntryFault::Damaged,
        ),
        (
            "legacy capture",
            file(1, "current", &legacy),
            EntryFault::Damaged,
        ),
        (
            "typed payload",
            file(1, "current", b"invalid payload"),
            EntryFault::Damaged,
        ),
        (
            "settings",
            file(1, "current", &wrong_settings),
            EntryFault::WrongSettings,
        ),
        (
            "kind",
            file(1, "current", &wrong_kind),
            EntryFault::WrongSettings,
        ),
        (
            "evidence",
            file(1, "current", &incomplete),
            EntryFault::Damaged,
        ),
    ] {
        let length = bytes.len() as u64;
        assert_eq!(
            Codec::default()
                .decode(&mut Cursor::new(bytes), length, &params(), "current")
                .err(),
            Some(fault),
            "{name}"
        );
    }
}

#[test]
fn writes_fit_both_the_whole_file_and_the_actual_disk_seed_frame() {
    let recipe = recipe();
    let encoded = Codec::default()
        .encode(&recipe, "current")
        .unwrap()
        .unwrap();
    let frame = serde_json::to_vec(&disk_seed_request(&recipe)).unwrap();
    let exact = Codec {
        file_bytes: encoded.len(),
        frame_bytes: frame.len(),
    };
    let encoded = exact.encode(&recipe, "current").unwrap().unwrap();
    let mut evaluation = params();
    evaluation.evaluation = Some("later evaluation".into());
    let restored = exact
        .decode(
            &mut Cursor::new(&encoded),
            encoded.len() as u64,
            &evaluation,
            "current",
        )
        .unwrap();
    assert_eq!(restored.compiled().code, "quoted \"code\"\n Unicode é");
    assert_eq!(
        Codec {
            file_bytes: encoded.len() - 1,
            frame_bytes: frame.len()
        }
        .encode(&recipe, "current")
        .unwrap(),
        None
    );
    assert_eq!(
        Codec {
            file_bytes: encoded.len(),
            frame_bytes: frame.len() - 1
        }
        .encode(&recipe, "current")
        .unwrap(),
        None
    );
    let mut input = ObservedInput {
        input: Cursor::new(encoded.clone()),
        payload: 0,
        reads: 0,
        payload_reads: 0,
    };
    assert_eq!(
        Codec {
            file_bytes: encoded.len() - 1,
            frame_bytes: frame.len()
        }
        .decode(&mut input, encoded.len() as u64, &params(), "current")
        .err(),
        Some(EntryFault::Damaged)
    );
    assert_eq!(input.reads, 0);

    let empty_header = file(1, "", b"").len() - 1;
    let version = "v".repeat(HEADER_BYTES - empty_header);
    let encoded = Codec::default().encode(&recipe, &version).unwrap().unwrap();
    assert_eq!(
        Codec::default()
            .decode(
                &mut Cursor::new(&encoded),
                encoded.len() as u64,
                &params(),
                &version,
            )
            .map(|restored| restored.compiled().code.clone()),
        Ok("quoted \"code\"\n Unicode é".into())
    );
}
