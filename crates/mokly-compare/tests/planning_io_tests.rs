//! Real base planning batches public inputs before rendering and survives cache eviction.

use std::io::Write;
use std::process::Command;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_compare::moves::Detector;
use mokly_css::parsed_cache::MemoryParsedCss;
use mokly_git::command::{Cancellation, Output, Request, Runner};
use mokly_git::error::Result;
use mokly_model::canonical;

#[expect(dead_code, reason = "these fixtures exercise only resource IO")]
mod engine_support;
use engine_support::{Fixture, runner};

struct Counted {
    inner: Arc<dyn Runner>,
    blobs: AtomicUsize,
}
impl Runner for Counted {
    fn checkpoint(&self) -> Result<()> {
        self.inner.checkpoint()
    }
    fn run(&self, request: &Request) -> Result<Output> {
        if request.args.iter().any(|arg| arg == "cat-file") {
            self.blobs.fetch_add(1, Ordering::SeqCst);
        }
        self.inner.run(request)
    }
    fn copy(&self, request: &Request, output: &mut (dyn Write + Send), bytes: usize) -> Result<()> {
        self.inner.copy(request, output, bytes)
    }
    fn digest(&self, request: &Request) -> Result<String> {
        if request.args.iter().any(|arg| arg == "cat-file") {
            self.blobs.fetch_add(1, Ordering::SeqCst);
        }
        self.inner.digest(request)
    }
    fn run_cancellable(
        &self,
        request: &Request,
        cancellation: &dyn Cancellation,
    ) -> Result<Output> {
        self.inner.run_cancellable(request, cancellation)
    }
    fn digest_cancellable_with_environment_timeout(
        &self,
        request: &Request,
        cancellation: &dyn Cancellation,
        environment: &[(&str, std::ffi::OsString)],
        timeout: std::time::Duration,
    ) -> Result<String> {
        if request.args.iter().any(|arg| arg == "cat-file") {
            self.blobs.fetch_add(1, Ordering::SeqCst);
        }
        self.inner.digest_cancellable_with_environment_timeout(
            request,
            cancellation,
            environment,
            timeout,
        )
    }
    fn stream_cancellable_with_environment_timeout(
        &self,
        request: &Request,
        cancellation: &dyn Cancellation,
        environment: &[(&str, std::ffi::OsString)],
        timeout: std::time::Duration,
        output: &mut (dyn Write + Send),
        limit: usize,
    ) -> Result<()> {
        self.blobs.fetch_add(1, Ordering::SeqCst);
        self.inner.stream_cancellable_with_environment_timeout(
            request,
            cancellation,
            environment,
            timeout,
            output,
            limit,
        )
    }
    fn run_cancellable_with_environment(
        &self,
        request: &Request,
        cancellation: &dyn Cancellation,
        environment: &[(&str, std::ffi::OsString)],
    ) -> Result<Output> {
        self.inner
            .run_cancellable_with_environment(request, cancellation, environment)
    }
    fn run_cancellable_with_environment_timeout(
        &self,
        request: &Request,
        cancellation: &dyn Cancellation,
        environment: &[(&str, std::ffi::OsString)],
        timeout: std::time::Duration,
    ) -> Result<Output> {
        if request.args.iter().any(|arg| arg == "cat-file") {
            self.blobs.fetch_add(1, Ordering::SeqCst);
        }
        self.inner.run_cancellable_with_environment_timeout(
            request,
            cancellation,
            environment,
            timeout,
        )
    }
}

fn fixture(size: usize) -> Fixture {
    let files: Vec<_> = (0..size).flat_map(|index| [
        (format!("specs/screen-{index}.screen.html"), format!("---\ntitle: Screen {index}\n---\n<img src=\"../../images/{index}.svg\"><link rel=\"stylesheet\" href=\"../../styles/{index}.css\">")),
        (format!("images/{index}.svg"), "<svg/>".into()),
        (format!("styles/{index}.css"), format!("p{{background:url(../images/{index}.svg)}}")),
    ]).collect();
    let fixture = Fixture::new(
        &files
            .iter()
            .map(|(path, text)| (path.as_str(), text.as_str()))
            .collect::<Vec<_>>(),
    );
    // Git for Windows sets `core.autocrlf=true` for the whole system, which
    // converts line endings on checkout. Pin identity conversion in the
    // repository, so the base bytes equal the committed bytes on every host.
    let status = Command::new("git")
        .args(["config", "core.autocrlf", "false"])
        .current_dir(fixture.directory.path())
        .status()
        .unwrap();
    assert!(status.success());
    fixture
}

#[test]
fn end_to_end_planning_batches_are_constant_at_ten_and_forty_screens() {
    let run = |size| {
        let fixture = fixture(size);
        fixture.edit("images/0.svg", "<svg>changed</svg>");
        let counted = Arc::new(Counted {
            inner: runner(),
            blobs: AtomicUsize::new(0),
        });
        let result = fixture
            .compare_io(
                Arc::new(Detector),
                Arc::new(MemoryParsedCss::new(4096)),
                counted.clone(),
                48 * 1024 * 1024,
            )
            .unwrap();
        assert_eq!(result.snapshot.changed_entries, ["screen-0"]);
        counted.blobs.load(Ordering::SeqCst)
    };
    let small = run(10);
    let large = run(40);
    assert!(small > 0 && small <= 4, "small: {small}");
    assert_eq!(large, small);
    eprintln!("cat-file processes: 10 screens = {small}; 40 screens = {large}");
}

#[test]
fn source_and_resource_eviction_change_work_without_changing_comparison_results() {
    let fixture = fixture(10);
    fixture.edit("images/0.svg", "<svg>changed</svg>");
    let cached = fixture.compare().unwrap();
    let counted = Arc::new(Counted {
        inner: runner(),
        blobs: AtomicUsize::new(0),
    });
    let evicted = fixture
        .compare_io(
            Arc::new(Detector),
            Arc::new(MemoryParsedCss::new(4096)),
            counted.clone(),
            768,
        )
        .unwrap();
    assert!(counted.blobs.load(Ordering::SeqCst) > 4);
    assert_eq!(cached.snapshot.changed_entries, ["screen-0"]);
    assert_eq!(
        canonical::to_string(&cached.review).unwrap(),
        canonical::to_string(&evicted.review).unwrap()
    );
    assert_eq!(
        canonical::to_string(&cached.snapshot).unwrap(),
        canonical::to_string(&evicted.snapshot).unwrap()
    );
}
