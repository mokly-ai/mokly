//! Publish removes its private directory after success and keeps it after a failure.

use std::fs;
use std::path::{Path, PathBuf};

use mokly_test_support::files::link_directory;
use mokly_test_support::publication;
use mokly_test_support::receiver::{Exchange, Options};

use super::support::{missing, mokly, reservations};

/// Removes private roots that a test leaves behind, including renamed ones.
#[derive(Default)]
struct Leftovers(Vec<PathBuf>);

impl Drop for Leftovers {
    fn drop(&mut self) {
        for path in &self.0 {
            let _ = fs::remove_dir_all(path);
            let _ = fs::remove_file(path);
        }
    }
}

#[test]
fn publish_removes_its_whole_private_directory_after_success_and_after_already_published() {
    for attempts in [1, 2] {
        let repository = publication::fixture(false, "sha1");
        let receiver = Exchange::start(Options::default());
        let mut leftovers = Leftovers::default();
        for attempt in 0..attempts {
            let running = publication::publish(
                &mokly(),
                repository.path(),
                &receiver.endpoint,
                "plain",
                &[],
            )
            .spawn();
            let directory = running.build_directory();
            let observed = directory.clone();
            receiver.before_complete(Box::new(move |_| {
                let private_root = observed.wait().parent().unwrap().to_path_buf();
                reservations(&private_root);
                fs::write(
                    private_root.join("private-note"),
                    "owned by this publication",
                )
                .unwrap();
            }));
            let private_root = directory.wait().parent().unwrap().to_path_buf();
            leftovers.0.push(private_root.clone());
            let result = running.wait();
            assert_eq!(result.code, Some(0), "{}", result.stderr);
            assert_eq!(result.stderr, "");
            if attempt == 1 {
                assert!(result.stdout.contains("already published for this commit"));
            }
            if attempt == attempts - 1 {
                missing(&private_root);
            }
        }
        receiver.close();
    }
}

#[test]
fn publish_failure_retains_the_complete_private_directory_and_reservations() {
    let repository = publication::fixture(false, "sha1");
    let receiver = Exchange::start(Options {
        plan_status: Some(403),
        ..Options::default()
    });
    let running = publication::publish(
        &mokly(),
        repository.path(),
        &receiver.endpoint,
        "plain",
        &[],
    )
    .spawn();
    let output = running.build_directory().wait();
    let private_root = output.parent().unwrap().to_path_buf();
    let _leftovers = Leftovers(vec![private_root.clone()]);
    let result = running.wait();
    assert_eq!(result.code, Some(1));
    assert_eq!(receiver.record().completed, 0);
    assert!(output.join(".mokly-export-artifact").is_file());
    reservations(&private_root);
    receiver.close();
}

#[test]
fn publish_removes_a_private_sibling_symlink_and_preserves_its_target() {
    let repository = publication::fixture(false, "sha1");
    let receiver = Exchange::start(Options::default());
    let running = publication::publish(
        &mokly(),
        repository.path(),
        &receiver.endpoint,
        "plain",
        &[],
    )
    .spawn();
    let directory = running.build_directory();
    let observed = directory.clone();
    let target = repository.path().to_path_buf();
    receiver.before_complete(Box::new(move |_| {
        let private_root = observed.wait().parent().unwrap().to_path_buf();
        reservations(&private_root);
        link_directory(&target, &private_root.join("external"));
    }));
    let private_root = directory.wait().parent().unwrap().to_path_buf();
    let _leftovers = Leftovers(vec![private_root.clone()]);
    let result = running.wait();
    assert_eq!(result.code, Some(0), "{}", result.stderr);
    assert_eq!(
        fs::read_to_string(repository.path().join("signal.txt")).unwrap(),
        "original"
    );
    missing(&private_root);
    receiver.close();
}

#[test]
fn publish_cleanup_failure_warns_with_its_stored_private_root_and_keeps_success() {
    let repository = publication::fixture(false, "sha1");
    let receiver = Exchange::start(Options::default());
    let running = publication::publish(
        &mokly(),
        repository.path(),
        &receiver.endpoint,
        "plain",
        &[],
    )
    .spawn();
    let directory = running.build_directory();
    let observed = directory.clone();
    receiver.before_complete(Box::new(move |_| {
        let private_root = observed.wait().parent().unwrap().to_path_buf();
        let retained = retained(&private_root);
        fs::rename(&private_root, &retained).unwrap();
        fs::write(&private_root, "replacement blocks directory removal").unwrap();
    }));
    let private_root = directory.wait().parent().unwrap().to_path_buf();
    let retained = retained(&private_root);
    let _leftovers = Leftovers(vec![private_root.clone(), retained.clone()]);
    let result = running.wait();
    assert_eq!(result.code, Some(0), "{}", result.stderr);
    assert_eq!(receiver.record().completed, 1);
    assert_eq!(
        result.stderr,
        format!(
            "[mokly/warning] Publication completed. The local build remains at {}. Remove it when you no longer need it.\n",
            private_root.display()
        )
    );
    assert_eq!(
        fs::read_to_string(&private_root).unwrap(),
        "replacement blocks directory removal"
    );
    reservations(&retained);
    receiver.close();
}

fn retained(private_root: &Path) -> PathBuf {
    let mut name = private_root.as_os_str().to_owned();
    name.push("-retained");
    PathBuf::from(name)
}
