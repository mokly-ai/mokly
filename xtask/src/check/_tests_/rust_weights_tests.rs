//! Rust test weights: each CI host places its test shards by its own
//! measured test seconds, and the committed file serves every host.

use std::collections::BTreeSet;

use super::rust_partition::{Piece, partition};
use super::rust_targets::TestUnit;
use super::rust_weights::{Host, WeightFile};

fn test(name: &str) -> TestUnit {
    TestUnit::Test(name.into())
}

fn whole(name: &str) -> Piece {
    Piece::whole(&test(name))
}

/// `slow` and `fast` swap their test seconds on Windows, so the two hosts
/// put them on different shards. Every host shares the compile seconds, and a
/// host that the file does not name gets no test seconds: on macOS each unit
/// weighs its compile seconds only.
#[test]
fn each_host_places_its_shards_by_its_own_test_seconds() {
    let file = WeightFile::parse(
        r#"{"defaultSeconds": 1, "docSeconds": 0, "compileSeconds": {"--test slow": 1, "--test fast": 2, "--test other": 2}, "testSeconds": {"linux": {"--test slow": 10, "--test fast": 1}, "windows": {"--test slow": 1, "--test fast": 10}}}"#,
    )
    .unwrap();
    let units: BTreeSet<_> = [test("slow"), test("fast"), test("other")].into();
    assert_eq!(
        partition(&units, &file.host(Host::Linux), 2),
        [vec![whole("slow")], vec![whole("fast"), whole("other")]]
    );
    assert_eq!(
        partition(&units, &file.host(Host::Windows), 2),
        [vec![whole("fast")], vec![whole("other"), whole("slow")]]
    );
    assert_eq!(
        partition(&units, &file.host(Host::Macos), 2),
        [vec![whole("fast"), whole("slow")], vec![whole("other")]]
    );
}

/// Every unit runs on exactly one shard, whole or as each of its slices once,
/// with the committed weights of every host.
#[test]
fn every_unit_runs_on_exactly_one_shard_for_every_total() {
    let file = WeightFile::embedded().unwrap();
    let units: BTreeSet<_> = (0..40)
        .map(|index| test(&format!("unit_{index}")))
        .chain([TestUnit::Libraries, test("integration_tests"), test("cli")])
        .collect();
    for (host, total) in [Host::Linux, Host::Macos, Host::Windows]
        .into_iter()
        .flat_map(|host| (1..=50_u64).map(move |total| (host, total)))
    {
        let pieces: Vec<_> = partition(&units, &file.host(host), total)
            .into_iter()
            .flatten()
            .collect();
        for unit in &units {
            let mut slices: Vec<_> = pieces
                .iter()
                .filter(|piece| piece.unit == *unit)
                .map(|piece| piece.slice)
                .collect();
            slices.sort();
            let expected: Vec<_> = match slices.first() {
                Some(Some((_, count))) => (1..=*count).map(|index| Some((index, *count))).collect(),
                _ => vec![None],
            };
            assert_eq!(slices, expected, "{unit:?} with {total} shards on {host:?}");
        }
    }
}
