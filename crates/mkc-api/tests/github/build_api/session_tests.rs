//! Expired credentials never fall back to anonymous history or build access.

use chrono::{Duration, Utc};
use mkc_auth::session_policy::new_session;
use reqwest::Method;
use serde_json::json;

use super::super::harness::Harness;
use super::support::{refusal, schedule};

#[test]
fn absolute_and_idle_session_expiry_refuse_every_build_operation() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let build = schedule(&app, &project, "topic", 1, None, Utc::now());
    for days in [31, 8] {
        let token = format!("{days:064x}");
        let session = new_session(
            app.user,
            &token,
            &app.csrf,
            Utc::now() - Duration::days(days),
        );
        app.cookie = format!("mkc_session={token}");
        for (method, tail, body) in [
            (Method::GET, "history".into(), None),
            (Method::GET, format!("builds/{build}"), None),
            (Method::GET, format!("builds/{build}/log"), None),
            (
                Method::POST,
                "builds".into(),
                Some(json!({"branch":"topic"})),
            ),
            (Method::POST, format!("builds/{build}/cancel"), None),
        ] {
            app.queries(&mut |queries| {
                queries.delete_session(&session.token_hash)?;
                queries.insert_session(&session)?;
                Ok(())
            });
            let mut request = app.request(method, &format!("/v1/projects/{}/{tail}", project.id));
            if let Some(body) = body {
                request = request.json(&body);
            }
            refusal(request.send().unwrap(), 401, "session-expired");
        }
    }
}
