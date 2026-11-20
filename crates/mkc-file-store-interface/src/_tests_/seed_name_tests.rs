//! Exact run grammar and the closed set of seed file paths.

#![allow(clippy::unwrap_used)]

use crate::seed_name::{Error, SeedName};

#[test]
fn accepts_seed_files_and_canonical_run_boundaries() {
    for run in [
        "local".to_owned(),
        "0".to_owned(),
        "1-2".to_owned(),
        "a-abcdefghijklmnopqrstuvwxyz0123456789-".to_owned(),
        "a".repeat(50),
    ] {
        for file in [
            "request.json",
            "catalogue/plan.tar.gz",
            "catalogue/blobs/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            "seed-status.json",
            "seed-proof.json",
        ] {
            assert_eq!(
                SeedName::new(&run, file).unwrap().as_str(),
                format!("seed/{run}/{file}"),
                "{run:?}/{file:?}"
            );
        }
    }
}

#[test]
fn rejects_runs_outside_the_canonical_grammar() {
    for run in [
        String::new(),
        "a".repeat(51),
        "-local".to_owned(),
        "LOCAL".to_owned(),
        "local_1".to_owned(),
        "../local".to_owned(),
        "/local".to_owned(),
        "local/1".to_owned(),
        "local\\1".to_owned(),
        "local%2f1".to_owned(),
        "local\0".to_owned(),
        "local\n".to_owned(),
        " local".to_owned(),
        "local ".to_owned(),
        "lócál".to_owned(),
        "１".to_owned(),
    ] {
        assert_eq!(
            SeedName::new(&run, "request.json"),
            Err(Error::InvalidRun),
            "{run:?}"
        );
    }
}

#[test]
fn rejects_unknown_noncanonical_or_escaping_seed_files() {
    for file in [
        "",
        "request.JSON",
        "other.json",
        "/request.json",
        "./request.json",
        "../request.json",
        "catalogue/../request.json",
        "catalogue//plan.tar.gz",
        "catalogue\\plan.tar.gz",
        "catalogue%2fplan.tar.gz",
        "request.json/",
        "request.json\0",
        "request.json\n",
        "catalogue/blobs/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde",
        "catalogue/blobs/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0",
        "catalogue/blobs/0123456789ABCDEF0123456789abcdef0123456789abcdef0123456789abcdef",
        "catalogue/blobs/g123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        "catalogue/blobs/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef/x",
        "catalogue/blobs/../request.json",
    ] {
        assert_eq!(
            SeedName::new("local", file),
            Err(Error::InvalidFile),
            "{file:?}"
        );
    }
}
