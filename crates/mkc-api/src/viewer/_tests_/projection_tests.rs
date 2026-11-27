//! Public response values derive only from persisted identities and released artifacts.

use mkc_domain::values::Visibility;
use mkc_mokly_contract::index::CatalogueIndex;
use mkc_mokly_contract::index_values::{ColorScheme, Viewport};
use mkc_mokly_contract::limits::Limits;
use mkc_store_interface::publication::{PublicationFailure, PublicationState};
use mkc_store_interface::viewer::PublicationPullRequest;
use serde_json::{Value, json};
use url::Url;

use crate::viewer::input::Selection;
use crate::viewer::projection;

use super::policy_data::pull_request;
use super::support::{PUBLICATION, locations, publication, viewer_publication};

#[test]
fn fork_fact_does_not_depend_on_open_or_merged_state() {
    for fork in [false, true] {
        for (open, merged) in [(true, false), (false, false), (false, true)] {
            let mut row = pull_request();
            row.key.open = open;
            row.merged = merged;
            row.repositories.head = Some(row.repositories.bound + i64::from(fork));
            let value = serde_json::to_value(projection::pull_request(row)).unwrap();
            assert_eq!(value["fork"], fork);
        }
    }
}

#[test]
fn current_screens_and_views_come_from_the_comparison_not_changes_membership() {
    let mut document: Value = serde_json::from_slice(include_bytes!(
        "../../../../mkc-mokly-contract/fixtures/index-v9.json"
    ))
    .unwrap();
    for record in document["screens"].as_array_mut().unwrap() {
        record["changes"]["included"] = json!(false);
    }
    document["screens"][0]["views"]
        .as_array_mut()
        .unwrap()
        .remove(0);
    let index =
        CatalogueIndex::parse(&serde_json::to_vec(&document).unwrap(), Limits::default()).unwrap();
    let screens = projection::screens(&index);
    assert_eq!(
        screens.iter().map(|s| s.path.as_str()).collect::<Vec<_>>(),
        ["finish", "start"]
    );
    assert!(screens.iter().all(|s| !s.views.is_empty()));
    let json = serde_json::to_value(&screens).unwrap();
    assert_eq!(json[0]["path"], "finish");
    assert!(json[0].get("id").is_none());
    assert_eq!(screens[0].views.len(), 1);
    document["screens"][0]["views"] = json!([]);
    let index =
        CatalogueIndex::parse(&serde_json::to_vec(&document).unwrap(), Limits::default()).unwrap();
    assert_eq!(projection::screens(&index).len(), 1);
}

#[test]
fn failure_and_current_only_context_do_not_invent_changes_or_catalogues() {
    let mut context = viewer_publication(false);
    let row = &mut context.publication;
    row.state = PublicationState::Failed;
    row.failure = Some(PublicationFailure::InvalidBundle);
    row.metadata = None;
    row.changes = None;
    let value = serde_json::to_value(projection::publication(&context, &locations())).unwrap();
    assert_eq!(value["failureCode"], "invalid-bundle");
    for key in [
        "branch",
        "headSha",
        "catalogueUrl",
        "reviewId",
        "pullRequest",
    ] {
        assert!(value[key].is_null());
    }
    assert_eq!(value["changes"]["state"], "unavailable");
    assert!(value["changes"]["added"].is_null());
    assert_eq!(value["canComment"], false);
    let ready = serde_json::to_value(projection::publication(
        &viewer_publication(false),
        &locations(),
    ))
    .unwrap();
    assert_eq!(
        ready["catalogueUrl"],
        format!("https://p-{PUBLICATION}.br-main.preview.example.net")
    );
}

/// An observation from before author retention keeps no author, so the read
/// answers `author: null` and never invents one.
#[test]
fn a_pull_request_observed_without_an_author_reads_a_null_author() {
    let mut context = viewer_publication(false);
    context.pull_request = Some(PublicationPullRequest {
        number: 7,
        title: "Publication origin".into(),
        author: None,
        repository: "mokly-ai/mokly-cloud".into(),
    });
    let value = serde_json::to_value(projection::publication(&context, &locations())).unwrap();
    assert_eq!(
        value["pullRequest"],
        json!({
            "number": 7,
            "title": "Publication origin",
            "author": null,
            "url": "https://github.com/mokly-ai/mokly-cloud/pull/7",
        })
    );

    let mut row = pull_request();
    row.author = None;
    let value = serde_json::to_value(projection::pull_request(row)).unwrap();
    assert_eq!(value.get("author"), Some(&Value::Null));
}

#[test]
fn share_encodes_an_already_validated_selection_once() {
    let id = "Product/Welcome_1";
    let selection = Selection {
        screen: Some(id.parse().unwrap()),
        viewport: Some(Viewport::Mobile),
        scheme: Some(ColorScheme::Dark),
    };
    let result = projection::share(
        &publication(true),
        &"mokly".parse().unwrap(),
        &"cloud".parse().unwrap(),
        Visibility::Private,
        &selection,
        &locations(),
    )
    .unwrap();
    assert_eq!(
        result.url,
        include_str!("../../../../../fixtures/viewer-share-url.txt").trim_end_matches('\n')
    );
    let url = Url::parse(&result.url).unwrap();
    assert_eq!(
        url.path(),
        format!("/mokly/cloud/publications/{PUBLICATION}")
    );
    assert_eq!(
        url.query_pairs().next().unwrap(),
        ("catalogueScreen".into(), id.into())
    );
    assert!(!url.query_pairs().any(|(key, _)| key == "screen"));
    assert_eq!(serde_json::to_value(result).unwrap()["access"], "members");
    let result = projection::share(
        &publication(false),
        &"mokly".parse().unwrap(),
        &"cloud".parse().unwrap(),
        Visibility::Public,
        &Selection::default(),
        &locations(),
    )
    .unwrap();
    assert!(!result.url.contains('?'));
    assert_eq!(serde_json::to_value(result).unwrap()["access"], "public");
}
