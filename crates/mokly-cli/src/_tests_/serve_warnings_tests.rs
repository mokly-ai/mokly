//! Warning scopes sort, deduplicate, retain failed identities, and fence old producers.

use std::sync::{Arc, Mutex};

use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_cli::build_output;
use mokly_cli::cancellation::{Cancellation, ServeCancellation};
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use unimock::{MockFn, Unimock, matching};

use crate::serve_warnings::{ServeWarnings, WarningScopes};
use crate::terminal::TerminalMock;

fn warning(message: &str) -> Warning {
    Warning {
        code: "link-control-ancestor",
        subject: WarningSubject::Route("home/index.mobile.html".into()),
        message: message.into(),
    }
}

struct Fixture {
    sink: Arc<dyn WarningScopes>,
    output: Arc<Mutex<String>>,
    stopped: Arc<ServeCancellation>,
    style: Style,
}

impl Fixture {
    fn new(mode: Mode) -> Self {
        let output = Arc::new(Mutex::new(String::new()));
        let stopped = Arc::new(ServeCancellation::default());
        let terminal = Unimock::new(TerminalMock::stderr.each_call(matching!(_)).answers_arc(
            Arc::new({
                let output = output.clone();
                move |_, text| output.lock().unwrap().push_str(text)
            }),
        ));
        let style = Style {
            mode,
            color: false,
            ascii: false,
            columns: 200,
        };
        Self {
            sink: Arc::new(ServeWarnings::new(
                stopped.clone(),
                Arc::new(terminal),
                style.clone(),
                Arc::new(Redactor::default()),
            )),
            output,
            stopped,
            style,
        }
    }

    fn finish(&self, warnings: &[Warning], label: &str) {
        let mut output = self.output.lock().unwrap();
        output.push_str(&build_output::warnings(
            &self.style,
            warnings,
            &Redactor::default(),
        ));
        output.push_str(label);
    }
}

#[test]
fn build_warning_completion_sorts_both_producers_then_demand_prints_only_new_records() {
    for mode in [Mode::Plain, Mode::Rich] {
        let fixture = Fixture::new(mode);
        let attempt = fixture.sink.begin();
        attempt.report(&[warning("z"), warning("a"), warning("z")], false);
        assert!(fixture.output.lock().unwrap().is_empty());
        attempt.finish(&[warning("a")], false, &|warnings| {
            fixture.finish(warnings, "ready\n")
        });
        attempt.report(&[warning("a"), warning("demand"), warning("demand")], false);
        let prefix = if mode == Mode::Plain {
            "[mokly/warning]"
        } else {
            "  !"
        };
        assert_eq!(
            *fixture.output.lock().unwrap(),
            format!(
                "{prefix} home/index.mobile.html: a\n{prefix} home/index.mobile.html: z\nready\n{prefix} home/index.mobile.html: demand\n"
            )
        );
    }
}

#[test]
fn build_warning_failure_chain_keeps_seen_records_until_a_repair_succeeds() {
    let fixture = Fixture::new(Mode::Plain);
    let failed = fixture.sink.begin();
    failed.report(&[warning("first")], false);
    failed.finish(&[warning("first")], true, &|warnings| {
        fixture.finish(warnings, "failed\n")
    });
    failed.report(&[warning("late")], false);
    let repair = fixture.sink.begin();
    repair.finish(
        &[warning("first"), warning("late"), warning("new")],
        true,
        &|warnings| fixture.finish(warnings, "failed\n"),
    );
    let repair = fixture.sink.begin();
    repair.finish(&[warning("first"), warning("new")], false, &|warnings| {
        fixture.finish(warnings, "ready\n")
    });
    repair.report(&[warning("first")], false);
    let fresh = fixture.sink.begin();
    fresh.finish(&[warning("first")], false, &|warnings| {
        fixture.finish(warnings, "ready\n")
    });
    assert_eq!(
        *fixture.output.lock().unwrap(),
        concat!(
            "[mokly/warning] home/index.mobile.html: first\nfailed\n",
            "[mokly/warning] home/index.mobile.html: late\n",
            "[mokly/warning] home/index.mobile.html: new\nfailed\nready\n",
            "[mokly/warning] home/index.mobile.html: first\nready\n",
        )
    );
}

#[test]
fn build_warning_old_completion_and_failure_cannot_flush_a_replacement() {
    let fixture = Fixture::new(Mode::Plain);
    let old = fixture.sink.begin();
    old.report(&[warning("discard")], false);
    let current = fixture.sink.begin();
    current.report(&[warning("current")], false);
    old.report(&[warning("late")], true);
    old.finish(&[warning("replay")], true, &|_| {
        panic!("retired completion")
    });
    assert!(fixture.output.lock().unwrap().is_empty());
    current.finish(&[], false, &|warnings| fixture.finish(warnings, "ready\n"));
    old.report(&[warning("late")], false);
    current.report(&[warning("on demand")], false);
    assert_eq!(
        *fixture.output.lock().unwrap(),
        "[mokly/warning] home/index.mobile.html: current\nready\n[mokly/warning] home/index.mobile.html: on demand\n"
    );
}

#[test]
fn build_warning_render_failure_retains_seen_set_and_cancellation_discards_every_producer() {
    let fixture = Fixture::new(Mode::Plain);
    let attempt = fixture.sink.begin();
    attempt.finish(&[], false, &|warnings| fixture.finish(warnings, "ready\n"));
    attempt.report(&[warning("before render failure")], true);
    let repair = fixture.sink.begin();
    repair.finish(&[warning("before render failure")], false, &|warnings| {
        fixture.finish(warnings, "ready\n")
    });
    fixture.stopped.interrupt();
    repair.report(&[warning("cancelled")], true);
    repair.finish(&[warning("cancelled")], true, &|_| {
        panic!("cancelled completion")
    });
    assert_eq!(
        *fixture.output.lock().unwrap(),
        "ready\n[mokly/warning] home/index.mobile.html: before render failure\nready\n"
    );
}

#[test]
fn build_warning_resource_reload_keeps_the_failed_scope_without_reviving_old_producers() {
    let fixture = Fixture::new(Mode::Plain);
    let old = fixture.sink.begin();
    let failed = fixture.sink.begin();
    failed.finish(&[warning("kept")], true, &|warnings| {
        fixture.finish(warnings, "failed\n")
    });
    let reload = fixture.sink.current();
    reload.finish(&[warning("kept")], false, &|warnings| {
        fixture.finish(warnings, "reload\n")
    });
    old.report(&[warning("old")], false);
    reload.report(&[warning("new")], false);
    let repair = fixture.sink.begin();
    repair.finish(&[warning("kept"), warning("new")], false, &|warnings| {
        fixture.finish(warnings, "ready\n")
    });
    assert_eq!(
        *fixture.output.lock().unwrap(),
        concat!(
            "[mokly/warning] home/index.mobile.html: kept\nfailed\nreload\n",
            "[mokly/warning] home/index.mobile.html: new\nready\n",
        )
    );
}
