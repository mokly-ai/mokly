//! Captured Testbox calls for snapshot runner fixtures.

use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::remote::contracts::*;

use super::snapshot_runner_support::{Case, event, output};

/// Mock every box call and retain its directory, source identity and evidence path.
pub(super) fn client(case: Case, events: Arc<Mutex<Vec<String>>>) -> Arc<Unimock> {
    let warm_events = events.clone();
    let run_events = events.clone();
    let download_events = events.clone();
    let next_box = AtomicUsize::new(0);
    Arc::new(Unimock::new((
        BlacksmithWarmupMock.each_call(matching!("main")).answers_arc(Arc::new(move |_, _| {
            event(&warm_events, "warmup"); Ok(output(format!("tbx_{}\n", next_box.fetch_add(1, Ordering::SeqCst))))
        })),
        BlacksmithRunMock.each_call(matching!(_, _, _, _)).answers_arc(Arc::new(move |_, cwd, _, command, log| {
            assert_eq!(cwd, Path::new("/workspace/.context/verification-snapshots/20261006T120000Z-42"));
            event(&run_events, if log.is_none() { "probe" } else { "suite" });
            if let Some(log) = log {
                assert!(log.starts_with("/workspace/.context/verification-logs/remote"));
                assert!(command.starts_with("node scripts/verification/testbox-suite.mjs --expect sha256:"));
                Ok(output(String::new()))
            } else {
                assert_eq!(command, format!("node scripts/verification/source-tree.mjs --expect sha256:{} --print-head", "a".repeat(64)));
                Ok(output(format!("sha256:{}\n{}\n", "a".repeat(64), if case == Case::BehindHead { "d".repeat(40) } else { "b".repeat(40) })))
            }
        })),
        BlacksmithDownloadMock.each_call(matching!(_, _, _)).answers_arc(Arc::new(move |_, _, _, target| {
            assert!(target.starts_with("/workspace/.context/verification-reports/remote"));
            event(&download_events, "download"); Ok(())
        })),
        BlacksmithDisconnectMock.each_call(matching!(_)).answers(&|_, _| Ok(Disconnection::Closed)),
        BlacksmithStatusMock.each_call(matching!(_)).answers(&|_, id| Ok(format!("ID STATUS\n{id} completed\n"))),
    )).no_verify_in_drop())
}
