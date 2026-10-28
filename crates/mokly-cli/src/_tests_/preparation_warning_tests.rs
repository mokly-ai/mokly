//! Startup rechecks report the adopted pass, retaining earlier warnings only on failure.

use std::path::Path;
use std::sync::Arc;

use mokly_cli::grammar::Common;
use mokly_server::error::ServerError;
use unimock::{MockFn, Unimock, matching};

use crate::serve_preparation;
use crate::serve_watch::{CandidateWatch, WatchInputsMock};
use crate::warning_support::{Scripted, catalogue, invalid, plan, scopes, warning};

#[tokio::test]
async fn startup_recheck_discards_first_pass_warnings_only_on_success() {
    for outcome in ["success", "preparation failure", "recheck failure"] {
        let second = if outcome == "preparation failure" {
            Err(invalid(vec![warning("second")]))
        } else {
            Ok(catalogue(vec![warning("second")]))
        };
        let script = Scripted::new(vec![Ok(catalogue(vec![warning("first")])), second]);
        let terminal = Unimock::new(());
        let warnings = scopes(&terminal);
        let attempt = warnings.begin();
        let observer = Unimock::new(());
        let candidate = WatchInputsMock::candidate
            .next_call(matching!(_))
            .returns(Ok(CandidateWatch {
                plan: plan(),
                observer: Arc::new(observer.clone()),
                recheck: true,
            }));
        let begin = || WatchInputsMock::begin.each_call(matching!()).returns(());
        let watch = match outcome {
            "preparation failure" => Unimock::new((begin(), candidate)),
            "recheck failure" => Unimock::new((
                begin(),
                candidate,
                WatchInputsMock::recheck
                    .next_call(matching!(_, _))
                    .returns(Err(ServerError::InvalidAssets)),
            )),
            _ => Unimock::new((
                begin(),
                candidate,
                WatchInputsMock::recheck
                    .next_call(matching!(_, _))
                    .returns(Ok(())),
                WatchInputsMock::adopt
                    .next_call(matching!(_, _))
                    .returns(()),
            )),
        };
        let result = serve_preparation::initial(
            script.preparation.clone(),
            Some(Arc::new(watch.clone())),
            attempt.clone(),
            Path::new("/repo"),
            &Common::default(),
        )
        .await;
        let records = match result {
            Ok(Ok(prepared)) => prepared.summary.warnings,
            Ok(Err(error)) => mokly_cli::build_output::warning_records(&error),
            Err(_) => vec![],
        };
        attempt.finish(&records, outcome != "success", &|records| {
            let expected = if outcome == "success" {
                vec![warning("second")]
            } else {
                vec![warning("first"), warning("second")]
            };
            assert_eq!(records, expected);
        });
    }
}
