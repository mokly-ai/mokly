//! Count the Git calls of opaque batches at two asset counts.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use mokly_git::command::{Output, RunnerMock};
use mokly_git::disk::DiskMock;
use mokly_git::identity::ObjectId;
use mokly_git::repository::{GitRepositories, Repositories};
use mokly_git::tree::Limits;
use mokly_graph::source_snapshot::SourceSnapshot;
use mokly_model::material::digest;
use mokly_source_interface::tree::{FileKind, SourceTree};
use unimock::{MockFn, Unimock, matching};

use crate::git_tree::GitTree;
use crate::sources::GitSources;

fn contents(index: usize) -> Vec<u8> {
    format!("asset-{index}\r\n").into_bytes()
}

fn measure(count: usize) -> BTreeMap<String, usize> {
    let calls = Arc::new(Mutex::new(BTreeMap::<String, usize>::new()));
    let captured = calls.clone();
    let streamed = calls.clone();
    let runner = Unimock::new((
        RunnerMock::run
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, request| {
                let kind = ["rev-parse", "ls-tree", "rev-list", "config", "check-attr"]
                    .into_iter()
                    .find(|kind| request.args.iter().any(|arg| arg == kind))
                    .unwrap();
                *captured.lock().unwrap().entry(kind.into()).or_default() += 1;
                let stdout = match kind {
                    "rev-parse" => b"/repo\n".to_vec(),
                    "ls-tree" => request
                        .args
                        .iter()
                        .filter_map(|arg| arg.to_str())
                        .filter_map(|path| {
                            let index = path
                                .strip_prefix("images/")?
                                .strip_suffix("/asset.svg")?
                                .parse::<usize>()
                                .ok()?;
                            Some(format!(
                                "100644 blob {:040x} {}\t{path}\0",
                                index + 1,
                                contents(index).len()
                            ))
                        })
                        .collect::<String>()
                        .into_bytes(),
                    "rev-list" => request.stdin.clone(),
                    "config" => b"false\n".to_vec(),
                    "check-attr" => Vec::new(),
                    _ => unreachable!(),
                };
                Ok(Output {
                    stdout,
                    stderr: Vec::new(),
                })
            })),
        RunnerMock::stream_cancellable_with_environment_timeout
            .each_call(matching!(_))
            .answers_arc(Arc::new(
                move |_, request, _, environment, timeout, output, limit| {
                    assert_eq!(environment, &[("LC_ALL", "C".into())]);
                    assert_eq!(timeout, Duration::from_secs(120));
                    assert!(limit > 48 * 1024 * 1024);
                    *streamed
                        .lock()
                        .unwrap()
                        .entry("cat-file".into())
                        .or_default() += 1;
                    if !request.args.iter().any(|arg| arg == "--batch") {
                        let path = request
                            .args
                            .iter()
                            .filter_map(|arg| arg.to_str())
                            .find_map(|arg| arg.strip_prefix("--path="))
                            .unwrap();
                        let index = path
                            .strip_prefix("images/")
                            .unwrap()
                            .strip_suffix("/asset.svg")
                            .unwrap()
                            .parse::<usize>()
                            .unwrap();
                        output.write_all(&contents(index)).unwrap();
                        return Ok(());
                    }
                    let fields: Vec<_> = request.stdin.split(|byte| *byte == 0).collect();
                    for pair in fields[..fields.len() - 1].chunks_exact(2) {
                        let line = str::from_utf8(pair[0]).unwrap();
                        let (object, path) = line.split_once(' ').unwrap();
                        let index = path
                            .strip_prefix("images/")
                            .unwrap()
                            .strip_suffix("/asset.svg")
                            .unwrap()
                            .parse::<usize>()
                            .unwrap();
                        let sentinel = str::from_utf8(pair[1]).unwrap();
                        output
                            .write_all(format!("{object} blob 1\0").as_bytes())
                            .unwrap();
                        output.write_all(&contents(index)).unwrap();
                        output
                            .write_all(format!("\0{sentinel} missing\0").as_bytes())
                            .unwrap();
                    }
                    Ok(())
                },
            )),
    ));
    let disk = Unimock::new(
        DiskMock::canonicalize
            .each_call(matching!(_))
            .answers(&|_, path| Ok(path.into()))
            .n_times(2),
    );
    let repository = GitRepositories {
        runner: Arc::new(runner),
        disk: Arc::new(disk),
    }
    .open(Path::new("/repo"))
    .unwrap();
    calls.lock().unwrap().clear();
    let sources = Arc::new(GitSources::new(
        repository,
        ObjectId::parse(&"a".repeat(40)).unwrap(),
        Limits::default(),
    ));
    let tree = Arc::new(GitTree::new("/repo".into(), sources, 4096));
    let snapshot = SourceSnapshot::new(tree.clone());
    let paths: Vec<PathBuf> = (0..count)
        .map(|index| PathBuf::from(format!("/repo/images/{index}/asset.svg")))
        .collect();
    for (index, result) in snapshot
        .digest_unretained_batch(&paths)
        .into_iter()
        .enumerate()
    {
        assert_eq!(result.unwrap(), digest(&contents(index)));
    }
    for (index, path) in paths.iter().enumerate() {
        assert_eq!(
            snapshot.digest_unretained(path).unwrap(),
            digest(&contents(index))
        );
        assert_eq!(
            tree.project(path.parent().unwrap()).unwrap().unwrap().kind,
            FileKind::Directory
        );
        assert!(
            !tree
                .cache
                .lock()
                .unwrap()
                .contains(&tree.relative(path).unwrap().unwrap())
        );
        assert_eq!(
            tree.digests.lock().unwrap()[&tree.relative(path).unwrap().unwrap()].length,
            Some(contents(index).len())
        );
    }
    assert_eq!(snapshot.retained_bytes(), 0);
    let measured = calls.lock().unwrap().clone();
    calls.lock().unwrap().clear();
    let mut stream = snapshot.open_stream(&paths[0]).unwrap();
    assert_eq!(stream.length(), contents(0).len() as u64);
    let mut output = Vec::new();
    stream
        .copy_verified(&paths[0], &digest(&contents(0)), &mut output)
        .unwrap();
    assert_eq!(output, contents(0));
    assert_eq!(
        *calls.lock().unwrap(),
        BTreeMap::from([("cat-file".into(), 1)])
    );
    measured
}

#[test]
fn opaque_batch_git_processes_stay_constant_at_four_and_sixteen_assets() {
    let small = measure(4);
    let large = measure(16);
    for kind in ["ls-tree", "rev-list", "config", "check-attr", "cat-file"] {
        assert!(small[kind] > 0, "missing interception of {kind}");
        assert_eq!(
            small[kind], large[kind],
            "{kind}: {small:?} versus {large:?}"
        );
    }
    assert_eq!(small.values().sum::<usize>(), 5);
}
