//! Ordered batching and injected runner failures.

use std::ffi::OsString;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::batches::{Batches, BoundedRunner, split};
use crate::command::{Output, RunnerMock};
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
        split(&prefix, &paths, 0, 100),
        Err(Error::InvalidBudget)
    ));
    assert!(matches!(
        split(&prefix, &paths, 1, 1),
        Err(Error::ArgumentLimit { .. })
    ));
}

#[test]
fn coordinator_stops_at_first_failure() {
    let mock = Arc::new(Unimock::new((
        RunnerMock::run
            .next_call(matching!((request) if request.args == vec![OsString::from("a")]))
            .returns(Ok(Output {
                stdout: b"a".to_vec(),
                stderr: vec![],
            })),
        RunnerMock::run
            .next_call(matching!((request) if request.args == vec![OsString::from("b")]))
            .returns(Err(Error::CommandFailed {
                status: Some(1),
                stderr: vec![],
            })),
    )));
    let runner: &dyn Batches = &BoundedRunner {
        runner: mock,
        max_arguments: 1,
        max_bytes: 100,
    };
    assert!(matches!(
        runner.run(
            "/checkout".as_ref(),
            &[],
            &["a".into(), "b".into(), "c".into()]
        ),
        Err(Error::CommandFailed { .. })
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
