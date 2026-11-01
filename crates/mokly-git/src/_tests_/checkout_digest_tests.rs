//! Digest batches hash each file separately and confine conversion failures.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use sha2::{Digest, Sha256};
use unimock::{MockFn, Unimock, matching};

use crate::command::{Output, RunnerMock};
use crate::error::Error;
use crate::identity::{ObjectId, RepoPath};
use crate::repository::{GitRepository, Repository};
use crate::tree::{Entry, Mode};

fn entry(index: usize) -> Entry {
    Entry {
        path: RepoPath::parse(&format!("{index}.svg")).unwrap(),
        object: ObjectId::parse(&format!("{:040x}", index + 1)).unwrap(),
        mode: Mode::File,
        size: 2,
    }
}

fn repository(runner: Unimock) -> GitRepository {
    GitRepository {
        fetch_lock: Mutex::new(()),
        unavailable: Mutex::new(BTreeMap::new()),
        timed_out: Mutex::new(BTreeSet::new()),
        directory: "/repo".into(),
        runner: Arc::new(runner),
        disk: Arc::new(Unimock::new(())),
    }
}

#[test]
fn a_failed_batch_retries_every_file_and_only_its_own_failed_file_is_unavailable() {
    for failure in ["filter", "deadline", "bound", "framing"] {
        let calls = Arc::new(Mutex::new(BTreeMap::<String, usize>::new()));
        let streams = calls.clone();
        let runner = Unimock::new((
            RunnerMock::run
                .each_call(matching!(_))
                .answers(&|_, request| {
                    let stdout = if request.args.iter().any(|arg| arg == "config") {
                        b"false\n".to_vec()
                    } else if request.args.iter().any(|arg| arg == "rev-list") {
                        request.stdin.clone()
                    } else {
                        Vec::new()
                    };
                    Ok(Output {
                        stdout,
                        stderr: Vec::new(),
                    })
                }),
            RunnerMock::stream_cancellable_with_environment_timeout
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, request, _, _, timeout, output, limit| {
                    assert_eq!(timeout, Duration::from_secs(120));
                    if request.args.iter().any(|arg| arg == "--batch") {
                        *streams.lock().unwrap().entry("batch".into()).or_default() += 1;
                        assert!(limit > 48 * 1024 * 1024);
                        return Err(match failure {
                            "deadline" => Error::CheckoutTimeout,
                            "bound" => Error::ByteLimit {
                                limit: 48 * 1024 * 1024,
                            },
                            "framing" => Error::MalformedOutput,
                            _ => Error::CheckoutFailed {
                                stderr: b"filter failed".to_vec(),
                            },
                        });
                    }
                    assert_eq!(limit, 64 * 1024 * 1024);
                    let path = request
                        .args
                        .iter()
                        .filter_map(|arg| arg.to_str())
                        .find_map(|arg| arg.strip_prefix("--path="))
                        .unwrap();
                    *streams.lock().unwrap().entry(path.into()).or_default() += 1;
                    if path == "1.svg" {
                        return Err(Error::CheckoutFailed {
                            stderr: b"filter failed".to_vec(),
                        });
                    }
                    output.write_all(path.as_bytes()).unwrap();
                    Ok(())
                })),
        ));
        let repo = repository(runner);
        let commit = ObjectId::parse(&"a".repeat(40)).unwrap();
        let results = repo.digest_many(&commit, &[entry(0), entry(1), entry(2)]);
        assert_eq!(results.len(), 3);
        for (index, result) in results.into_iter().enumerate() {
            if index == 1 {
                assert!(matches!(result, Err(Error::Conversion { path, .. }) if path == "1.svg"));
            } else {
                let result = result.unwrap();
                let bytes = format!("{index}.svg");
                let hash: String = Sha256::digest(bytes.as_bytes())
                    .iter()
                    .map(|byte| format!("{byte:02x}"))
                    .collect();
                assert_eq!(result.digest, hash);
                assert_eq!(result.length, bytes.len());
            }
        }
        let calls = calls.lock().unwrap();
        assert_eq!(calls["batch"], 1);
        for path in ["0.svg", "1.svg", "2.svg"] {
            assert!(calls[path] > 0, "{failure}: {calls:?}");
        }
    }
}

#[test]
fn a_large_digest_checks_conversion_attributes_once() {
    let calls = Arc::new(Mutex::new(BTreeMap::<String, usize>::new()));
    let observed = calls.clone();
    let runner = Unimock::new((
        RunnerMock::run.each_call(matching!(_)).answers_arc(Arc::new(move |_, request| {
            let config = request.args.iter().any(|arg| arg == "config");
            let kind = if config { "config" } else { "check-attr" };
            *observed.lock().unwrap().entry(kind.into()).or_default() += 1;
            Ok(Output {
                stdout: if config { b"false\n".to_vec() } else { b"0.svg\0filter\0shrink\0".to_vec() },
                stderr: Vec::new(),
            })
        })),
        RunnerMock::stream_cancellable_with_environment_timeout.next_call(matching!((request, _, _, timeout, _, limit)
            if request.args.iter().any(|arg| arg == "--filters") && *timeout == Duration::from_secs(120) && *limit == 64 * 1024 * 1024))
            .answers(&|_, _, _, _, _, output, _| { output.write_all(b"converted").unwrap(); Ok(()) }),
    ));
    let repo = repository(runner);
    let mut entry = entry(0);
    entry.size = 48 * 1024 * 1024 + 1;
    let mut results = repo.digest_many(&ObjectId::parse(&"a".repeat(40)).unwrap(), &[entry]);
    let result = results.pop().unwrap().unwrap();
    let hash: String = Sha256::digest(b"converted")
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    assert_eq!(result.digest, hash);
    assert_eq!(result.length, 9);
    assert_eq!(
        *calls.lock().unwrap(),
        BTreeMap::from([("config".into(), 1), ("check-attr".into(), 1)])
    );
}
