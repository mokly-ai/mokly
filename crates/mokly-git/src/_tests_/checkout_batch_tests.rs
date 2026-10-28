//! Batch requests name each blob with its path, and a batch past its deadline converts each file alone.

use std::ffi::OsString;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::checkout_batch::convert_entries;
use crate::checkout_files::MemoryFiles;
use crate::command::{Output, Request, RunnerMock};
use crate::error::Error;
use crate::identity::{ObjectId, RepoPath};
use crate::repository::GitRepository;
use crate::tree::{Entry, Limits, Mode};

fn entry(name: &str, object: char) -> Entry {
    Entry {
        path: RepoPath::parse(name).unwrap(),
        object: ObjectId::parse(&object.to_string().repeat(40)).unwrap(),
        mode: Mode::File,
        size: 2,
    }
}

fn commit() -> ObjectId {
    ObjectId::parse(&"c".repeat(40)).unwrap()
}

fn repository(mock: Unimock) -> GitRepository {
    GitRepository {
        fetch_lock: std::sync::Mutex::new(()),
        unavailable: std::sync::Mutex::new(std::collections::BTreeMap::new()),
        timed_out: std::sync::Mutex::new(std::collections::BTreeSet::new()),
        directory: "/repo".into(),
        runner: Arc::new(mock),
        disk: Arc::new(Unimock::new(())),
    }
}

/// The attribute-file lookup and the object presence check that precede a conversion.
fn preflight(entries: &[Entry]) -> impl unimock::Clause {
    let present = entries
        .iter()
        .map(|entry| format!("{}\n", entry.object))
        .collect::<String>()
        .into_bytes();
    (
        RunnerMock::run
            .next_call(matching!((request) if request.args.iter().any(|arg| arg == "ls-tree")))
            .returns(Ok(Output {
                stdout: Vec::new(),
                stderr: Vec::new(),
            })),
        RunnerMock::run
            .next_call(matching!((request) if request.args.iter().any(|arg| arg == "rev-list")))
            .returns(Ok(Output {
                stdout: present,
                stderr: Vec::new(),
            })),
    )
}

fn batch(request: &Request) -> bool {
    request.args[2..] == ["cat-file", "--batch", "--filters", "-Z"].map(OsString::from)
}

#[test]
fn a_batch_names_each_blob_and_path_and_a_leading_space_converts_alone() {
    let entries = [
        entry("a.txt", 'a'),
        entry(" lead.txt", 'b'),
        entry("z.txt", 'd'),
    ];
    let repository = repository(Unimock::new((
        preflight(&entries),
        RunnerMock::stream_cancellable_with_environment_timeout
            .next_call(matching!((request, _, _, _, _, _) if batch(request)))
            .answers(&|_, request, _, _, _, output, _| {
                let fields: Vec<_> = request.stdin.split(|byte| *byte == 0).collect();
                let sentinel = String::from_utf8(fields[1].to_vec()).unwrap();
                assert!(sentinel.starts_with("mokly-end-") && sentinel.len() == 42);
                assert_eq!(fields[0], format!("{} a.txt", "a".repeat(40)).as_bytes());
                assert_eq!(fields[2], format!("{} z.txt", "d".repeat(40)).as_bytes());
                assert_eq!(fields[3], fields[1]);
                for (object, content) in [('a', "A\r\n"), ('d', "Z\r\n")] {
                    let record = format!(
                        "{} blob 2\0{content}\0{sentinel} missing\0",
                        object.to_string().repeat(40)
                    );
                    output.write_all(record.as_bytes()).unwrap();
                }
                Ok(())
            }),
        RunnerMock::stream_cancellable_with_environment_timeout
            .next_call(matching!((request, _, _, _, _, _) if request.args[2..] == [
                "cat-file".into(), "--filters".into(), OsString::from("--path= lead.txt"), OsString::from("b".repeat(40))
            ]))
            .answers(&|_, _, _, _, _, output, _| {
                output.write_all(b"L\r\n").unwrap();
                Ok(())
            }),
    )));
    assert_eq!(
        repository
            .checkout_read(&commit(), &entries, Limits::default())
            .unwrap(),
        [b"A\r\n".to_vec(), b"L\r\n".to_vec(), b"Z\r\n".to_vec()]
    );
}

fn single(request: &Request) -> bool {
    request.args.get(3).is_some_and(|arg| arg == "--filters")
}

/// The next single-file `--filters` stream, for `name`: it writes `content`,
/// or reaches its deadline when there is no content.
fn alone(name: &'static str, content: Option<&'static [u8]>) -> impl unimock::Clause {
    RunnerMock::stream_cancellable_with_environment_timeout
        .next_call(matching!((request, _, _, _, _, _) if single(request)))
        .answers_arc(Arc::new(move |_, request, _, _, _, output, _| {
            assert_eq!(request.args[4], OsString::from(format!("--path={name}")));
            match content {
                Some(content) => {
                    output.write_all(content).unwrap();
                    Ok(())
                }
                None => Err(Error::CheckoutTimeout),
            }
        }))
}

/// Git's output for `a.txt` and `z.txt`, which a deadline can stop after any byte.
fn stale(sentinel: &str) -> Vec<u8> {
    format!(
        "{} blob 2\0STALE-A\0{sentinel} missing\0{} blob 2\0STALE-Z\0{sentinel} missing\0",
        "a".repeat(40),
        "d".repeat(40)
    )
    .into_bytes()
}

#[test]
fn a_batch_stopped_at_any_byte_by_its_deadline_converts_each_file_alone() {
    let entries = [entry("a.txt", 'a'), entry("z.txt", 'd')];
    for stop in 0..=stale(&"x".repeat(42)).len() {
        let repository = repository(Unimock::new((
            RunnerMock::stream_cancellable_with_environment_timeout
                .next_call(matching!((request, _, _, _, _, _) if batch(request)))
                .answers_arc(Arc::new(move |_, request, _, _, _, output, _| {
                    let fields: Vec<_> = request.stdin.split(|byte| *byte == 0).collect();
                    let output_bytes = stale(str::from_utf8(fields[1]).unwrap());
                    output.write_all(&output_bytes[..stop]).unwrap();
                    Err(Error::CheckoutTimeout)
                })),
            alone("a.txt", Some(b"A\r\n")),
            alone("z.txt", Some(b"Z\r\n")),
        )));
        let mut files = MemoryFiles::new(entries.len());
        convert_entries(&repository, &commit(), &entries, &mut files, 1024).unwrap();
        assert_eq!(
            files.into_files(),
            [b"A\r\n".to_vec(), b"Z\r\n".to_vec()],
            "stopped after {stop} bytes"
        );
    }
}

#[test]
fn a_file_that_reached_its_own_deadline_fails_at_once_in_a_later_call() {
    let repository = repository(Unimock::new(alone("z.txt", None)));
    let first = convert_entries(
        &repository,
        &commit(),
        &[entry("z.txt", 'd')],
        &mut MemoryFiles::new(1),
        1024,
    );
    assert!(matches!(first, Err(Error::Conversion { path, .. }) if path == "z.txt"));
    let later = convert_entries(
        &repository,
        &commit(),
        &[entry("a.txt", 'a'), entry("z.txt", 'd')],
        &mut MemoryFiles::new(2),
        1024,
    );
    assert!(
        matches!(later, Err(Error::Conversion { path, source }) if path == "z.txt" && matches!(*source, Error::CheckoutTimeout))
    );
}

#[test]
fn a_file_that_reaches_its_own_deadline_names_itself() {
    let entries = [entry("a.txt", 'a'), entry("z.txt", 'd')];
    let repository = repository(Unimock::new((
        preflight(&entries),
        RunnerMock::stream_cancellable_with_environment_timeout
            .next_call(matching!((request, _, _, _, _, _) if batch(request)))
            .returns(Err(Error::CheckoutTimeout)),
        alone("a.txt", Some(b"A\r\n")),
        alone("z.txt", None),
    )));
    assert!(matches!(
        repository.checkout_read(&commit(), &entries, Limits::default()),
        Err(Error::Conversion { path, source }) if path == "z.txt" && matches!(*source, Error::CheckoutTimeout)
    ));
}

/// A store whose writes fail with a typed error, as a full disk would.
struct FullDisk;

impl crate::checkout_files::BatchFiles for FullDisk {
    fn open(&mut self, _index: usize) -> crate::error::Result<()> {
        Ok(())
    }
    fn write(&mut self, _index: usize, _bytes: &[u8]) -> crate::error::Result<()> {
        Err(Error::InvalidPath {
            path: "no space left".into(),
        })
    }
}

/// The runner's copy maps a failed write to an internal I/O error, which the typed failure replaces.
fn copied(output: &mut (dyn std::io::Write + Send), bytes: &[u8]) -> crate::error::Result<()> {
    output
        .write_all(bytes)
        .map_err(|source| Error::Internal(crate::error::InternalError::Io { source }))
}

#[test]
fn a_failed_store_write_keeps_its_typed_error_in_both_paths() {
    for entries in [
        vec![entry("a.txt", 'a')],
        vec![entry("a.txt", 'a'), entry("z.txt", 'd')],
    ] {
        let repository = repository(Unimock::new(
            RunnerMock::stream_cancellable_with_environment_timeout
                .next_call(matching!(_))
                .answers(&|_, request, _, _, _, output, _| {
                    if !batch(request) {
                        return copied(output, b"bytes");
                    }
                    let fields: Vec<_> = request.stdin.split(|byte| *byte == 0).collect();
                    let sentinel = String::from_utf8(fields[1].to_vec()).unwrap();
                    let record = format!("{} blob 2\0bytes\0{sentinel} missing\0", "a".repeat(40));
                    copied(output, record.as_bytes())
                }),
        ));
        let result = convert_entries(&repository, &commit(), &entries, &mut FullDisk, 1024);
        assert!(
            matches!(&result, Err(Error::InvalidPath { path }) if path == "no space left"),
            "{} files: {result:?}",
            entries.len()
        );
    }
}
