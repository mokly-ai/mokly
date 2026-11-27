//! Consumer failures retain typed causes through member build reads.

use chrono::Utc;
use mkc_store_interface::build_attempt::BuildFinish;
use mkc_store_interface::build_state::{BuildFailure, BuildState, BuildStep};

use super::super::harness::Harness;
use super::support::{read, schedule, start};

#[test]
fn build_reads_return_consumer_causes_with_the_publish_exit_code() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    for (index, cause) in [BuildFailure::UncommittedChanges, BuildFailure::Exit]
        .into_iter()
        .enumerate()
    {
        let id = schedule(
            &app,
            &project,
            "failure-cause",
            index as u32,
            None,
            Utc::now(),
        );
        let build = start(&app, project.id, id);
        app.queries(&mut |q| {
            q.set_build_step(
                id,
                build.lease_token.unwrap(),
                BuildStep::Publish,
                Utc::now(),
            )?;
            assert!(q.finish_build(
                id,
                build.lease_token,
                &BuildFinish {
                    state: BuildState::Failed,
                    failure_cause: Some(cause),
                    exit_code: Some(9),
                    at: Utc::now(),
                    next_attempt_at: Utc::now(),
                }
            )?);
            Ok(())
        });
        let view = read(&app, project.id, &format!("builds/{id}"));
        assert_eq!(view["state"], "failed");
        assert_eq!(view["failure"]["cause"], cause.as_str());
        assert_eq!(view["failure"]["step"], "publish");
        assert_eq!(view["failure"]["exitCode"], 9);
    }
}
