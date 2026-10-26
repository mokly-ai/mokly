//! A re-plan uploads only the missing blobs and keeps the installed bytes.

use mokly_test_support::publication::{self, Outputs};
use mokly_test_support::receiver::{Exchange, Options, Replan};

use super::support::mokly;

#[test]
fn real_publish_re_plans_nonempty_and_empty_missing_sets_without_rebuilding_the_installed_bytes() {
    for replan in [Replan::Nonempty, Replan::Empty] {
        let root = publication::fixture(false, "sha1");
        let receiver = Exchange::start(Options {
            replan: Some(replan),
            ..Options::default()
        });
        let running = publication::publish(
            &mokly(),
            root.path(),
            &receiver.endpoint,
            "rich",
            &["--upload-concurrency=1"],
        )
        .spawn();
        receiver.observe(running.build_directory());
        let result = running.wait();
        let mut outputs = Outputs::default();
        outputs.push(publication::directory(&result.stdout));
        assert_eq!(result.code, Some(0), "{}", result.stderr);
        assert_eq!(result.stderr, "");
        let record = receiver.record();
        assert_eq!(record.bodies.len(), 2);
        assert_eq!(record.bodies[0], record.bodies[1]);
        assert_eq!(record.completion_attempts, 2);
        assert_eq!(record.completed, 1);
        assert_eq!(record.completed_inventories.len(), 1);
        let first = &record.missing_sets[0];
        assert!(first.len() > 1);
        let expected: &[String] = match replan {
            Replan::Nonempty => &first[..1],
            Replan::Empty => &[],
        };
        assert_eq!(record.missing_sets[1], expected);
        for (hash, attempts) in &record.attempts {
            let repeated = replan == Replan::Nonempty && *hash == first[0];
            assert_eq!(*attempts, if repeated { 2 } else { 1 });
        }
        assert_eq!(receiver.maximum_blob_concurrency(), 1);
        for phase in [
            "Rendering catalogue…",
            "Preparing upload…",
            "Uploading catalogue…",
            "Published Mokly catalogue",
        ] {
            assert_eq!(result.stdout.matches(phase).count(), 1, "{}", result.stdout);
        }
        receiver.close();
    }
}
