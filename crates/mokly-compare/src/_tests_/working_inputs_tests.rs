//! Working inputs compare bytes first and hash changed paths in one batch.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_git::error;
use mokly_git::identity::{ObjectId, RepoPath};
use mokly_git::repository::RepositoryMock;
use mokly_git::tree::Limits;
use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::inputs::Inputs;
use crate::working_inputs::{SystemWorkingInputs, WorkingInputs};

#[test]
fn equal_bytes_skip_hashes_and_changed_inputs_share_one_hash_batch() {
    for count in [1, 4] {
        for equal in [false, true] {
            let paths = (0..count)
                .map(|index| RepoPath::parse(&format!("pkg{index}/package.json")).unwrap())
                .collect::<Vec<_>>();
            let object = ObjectId::parse(&"a".repeat(40)).unwrap();
            let base = Inputs {
                files: paths
                    .iter()
                    .map(|path| (path.clone(), b"base".to_vec()))
                    .collect(),
                objects: paths
                    .iter()
                    .map(|path| (path.clone(), object.clone()))
                    .collect(),
            };
            let repository = Unimock::new((
                RepositoryMock::working_paths
                    .next_call(matching!())
                    .returns(Ok(paths.clone())),
                RepositoryMock::working_bytes
                    .each_call(matching!(_, _))
                    .answers_arc(Arc::new(move |_, _, _| {
                        Ok(Some(if equal {
                            b"base".to_vec()
                        } else {
                            b"converted".to_vec()
                        }))
                    }))
                    .n_times(count),
                RepositoryMock::working_hashes
                    .next_call(matching!(_, _))
                    .answers_arc(Arc::new(move |_, paths, _| {
                        assert_eq!(paths.len(), if equal { 0 } else { count });
                        Ok(if equal {
                            vec![]
                        } else {
                            vec![object.clone(); count]
                        })
                    })),
            ));
            let inputs = SystemWorkingInputs
                .read(&repository, &base, Limits::default())
                .unwrap();
            assert_eq!(inputs, base);
            assert!(inputs.files.values().all(|bytes| bytes == b"base"));
        }
    }
}

#[test]
fn a_working_input_file_overflow_reports_the_file_bound() {
    let repository = Unimock::new((
        RepositoryMock::working_paths
            .next_call(matching!())
            .returns(Ok(vec![RepoPath::parse("package.json").unwrap()])),
        RepositoryMock::working_bytes
            .next_call(matching!(_, _))
            .returns(Ok(Some(b"{}".to_vec()))),
    ));
    let result = SystemWorkingInputs.read(
        &repository,
        &Inputs {
            files: BTreeMap::new(),
            objects: BTreeMap::new(),
        },
        Limits {
            files: 0,
            bytes: 9999,
            ..Limits::default()
        },
    );
    assert!(matches!(
        result,
        Err(Error::Git {
            source: error::Error::FileCount { limit: 0 }
        })
    ));
}
