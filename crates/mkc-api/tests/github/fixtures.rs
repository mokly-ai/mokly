//! Static sanitized webhook deliveries; HTTP answers come from the double.

pub(super) fn delivery(name: &str) -> Vec<u8> {
    match name {
        "installation" => include_bytes!("../fixtures/github/installation-created.json").as_slice(),
        "uninstall" => include_bytes!("../fixtures/github/installation-deleted.json").as_slice(),
        "suspend" => include_bytes!("../fixtures/github/installation-suspended.json").as_slice(),
        "repositories" => {
            include_bytes!("../fixtures/github/installation-repositories.json").as_slice()
        }
        "repository" => include_bytes!("../fixtures/github/repository-renamed.json").as_slice(),
        "repository-edited" => {
            include_bytes!("../fixtures/github/repository-edited.json").as_slice()
        }
        "pull_request" => include_bytes!("../fixtures/github/pull-request.json").as_slice(),
        "push" => include_bytes!("../fixtures/github/push.json").as_slice(),
        "check_suite" => include_bytes!("../fixtures/github/check-suite.json").as_slice(),
        "check_run" => include_bytes!("../fixtures/github/check-run.json").as_slice(),
        "ping" => include_bytes!("../fixtures/github/ping.json").as_slice(),
        _ => panic!("unknown delivery: {name}"),
    }
    .to_vec()
}
