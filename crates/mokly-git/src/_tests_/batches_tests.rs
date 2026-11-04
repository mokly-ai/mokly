//! Ordered path splitting within count and byte budgets.

use std::ffi::OsString;

use crate::batches::split;
use crate::error::Error;

#[test]
fn batches_bound_count_and_bytes_and_preserve_order() {
    let prefix = vec![OsString::from("ls-tree"), OsString::from("--")];
    let paths: Vec<_> = ["a", "bb", "ccc", "dddd"]
        .into_iter()
        .map(OsString::from)
        .collect();
    let batches = split(&prefix, &paths, 2, 100).unwrap();
    assert_eq!(
        batches,
        vec![
            [prefix.clone(), paths[..2].to_vec()].concat(),
            [prefix.clone(), paths[2..].to_vec()].concat()
        ]
    );
    let batches = split(&prefix, &paths, 100, 32).unwrap();
    assert!(batches.iter().all(|batch| {
        batch
            .iter()
            .map(|arg| arg.as_encoded_bytes().len() * 2 + 2)
            .sum::<usize>()
            <= 32
    }));
    assert_eq!(
        batches
            .into_iter()
            .flat_map(|batch| batch.into_iter().skip(2))
            .collect::<Vec<_>>(),
        paths
    );
    assert!(split(&prefix, &[], 1, 100).unwrap().is_empty());
    assert!(matches!(
        split(&prefix, &paths, 1, 1),
        Err(Error::ArgumentLimit { .. })
    ));
}

#[test]
fn command_count_scales_linearly_with_the_number_of_paths() {
    let count = |size| {
        let paths: Vec<_> = (0..size)
            .map(|number| OsString::from(number.to_string()))
            .collect();
        split(&[], &paths, 10, 10_000).unwrap().len()
    };
    let small = count(100);
    let large = count(400);
    assert!(small > 0);
    assert_eq!(large, 4 * small);
}
