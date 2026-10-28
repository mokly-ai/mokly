//! A real Git batch that reaches its deadline converts each file alone, and a
//! file that hangs again is not converted a third time.

#![cfg(unix)]

use std::fs;
use std::sync::Arc;
use std::time::{Duration, Instant};

use mokly_git::control::{Clock, Token};
use mokly_git::disk::SystemDisk;
use mokly_git::identity::ObjectId;
use mokly_git::repository::{GitRepositories, Repositories, Repository};
use mokly_git::system::SystemRunner;
use mokly_git::tree::Limits;
use mokly_platform::processes::SystemProcessGroups;

#[expect(
    dead_code,
    reason = "these cases compose a runner with their own clock"
)]
mod support;
use support::Fixture;

/// Follows the system clock and jumps past the conversion deadline once for
/// each line that the hanging filter writes to its log, so a hang ends at
/// once while a fast conversion never reaches its deadline.
struct HangClock {
    start: Instant,
    log: std::path::PathBuf,
}

impl Clock for HangClock {
    fn now(&self) -> Duration {
        let hangs =
            fs::read(&self.log).map_or(0, |log| log.iter().filter(|byte| **byte == b'\n').count());
        self.start.elapsed() + Duration::from_secs(121) * hangs as u32
    }

    fn pause(&self, duration: Duration) {
        std::thread::sleep(duration);
    }
}

/// A repository whose `b.txt` filter hangs while `armed` exists, or always.
fn hanging(always: bool) -> (Fixture, ObjectId, Arc<dyn Repository>) {
    let fixture = Fixture::new();
    let wait = if always {
        "true"
    } else {
        "[ -e armed ] && rm armed"
    };
    let script = format!(
        "#!/bin/sh\nif [ \"$1\" = b.txt ] && {wait}; then echo hang >> hang.log; exec sleep 60; fi\nexec cat\n"
    );
    fixture.write("slow.sh", script.as_bytes());
    fixture.write(".gitattributes", b"*.txt filter=slow\n");
    for name in ["a", "b", "c"] {
        fixture.write(&format!("{name}.txt"), format!("{name}\n").as_bytes());
    }
    fixture.git(&["config", "filter.slow.clean", "cat"]);
    fixture.git(&["config", "filter.slow.smudge", "sh ./slow.sh %f"]);
    let base = fixture.commit();
    let repositories: &dyn Repositories = &GitRepositories {
        runner: Arc::new(SystemRunner {
            groups: Arc::new(SystemProcessGroups),
            cancellation: Arc::new(Token::default()),
            clock: Arc::new(HangClock {
                start: Instant::now(),
                log: fixture.root().join("hang.log"),
            }),
        }),
        disk: Arc::new(SystemDisk),
    };
    let repository = repositories.open(fixture.root()).unwrap();
    (fixture, base, repository)
}

fn hangs(fixture: &Fixture) -> usize {
    fs::read_to_string(fixture.root().join("hang.log")).map_or(0, |log| log.lines().count())
}

#[test]
fn a_batch_stopped_by_a_real_deadline_converts_each_file_alone() {
    let (fixture, base, repository) = hanging(false);
    let entries: Vec<_> = repository
        .list(&base, None, Limits::default())
        .unwrap()
        .into_iter()
        .filter(|entry| entry.path.as_str().ends_with(".txt"))
        .collect();
    fixture.write("armed", b"");
    assert_eq!(
        repository
            .read_many(&base, &entries, Limits::default())
            .unwrap(),
        [b"a\n".to_vec(), b"b\n".to_vec(), b"c\n".to_vec()]
    );
    assert_eq!(hangs(&fixture), 1);
    fixture.write("armed", b"");
    let temporary = tempfile::tempdir().unwrap();
    let target = temporary.path().join("sources");
    repository
        .extract(&base, &target, Limits::default())
        .unwrap();
    for name in ["a", "b", "c"] {
        assert_eq!(
            fs::read(target.join(format!("{name}.txt"))).unwrap(),
            format!("{name}\n").as_bytes()
        );
    }
    assert_eq!(hangs(&fixture), 2);
    assert!(repository.conversion_warnings().is_empty());
}

#[test]
fn a_filter_that_always_hangs_waits_for_two_deadlines_in_an_extraction() {
    let (fixture, base, repository) = hanging(true);
    let temporary = tempfile::tempdir().unwrap();
    let target = temporary.path().join("sources");
    repository
        .extract(&base, &target, Limits::default())
        .unwrap();
    assert_eq!(fs::read(target.join("a.txt")).unwrap(), b"a\n");
    assert_eq!(fs::read(target.join("c.txt")).unwrap(), b"c\n");
    assert!(!target.join("b.txt").exists());
    let warnings = repository.conversion_warnings();
    assert_eq!(warnings.len(), 1);
    assert_eq!(warnings[0].0, "b.txt");
    assert_eq!(hangs(&fixture), 2);
}
