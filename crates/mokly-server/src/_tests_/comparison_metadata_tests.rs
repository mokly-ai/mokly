//! A generation's review result is compact while its entry details keep two-space indentation.

use std::sync::Arc;

use mokly_catalogue::html_input::DeliveredHtml;
use mokly_graph::cache::Artifact;
use mokly_graph::types::RenderGenerationMock;
use mokly_html::composition::Composed;
use mokly_html::parse;
use mokly_model::usage::CatalogueUsage;
use mokly_model::{canonical, readers};
use unimock::{MockFn, Unimock, matching};

use crate::comparison_metadata;
use crate::comparison_support::{compact, historical, historical_inputs, snapshot};

/// The removed page's base document, parsed so its preview can be projected.
fn history() -> Arc<Artifact> {
    Arc::new(Artifact {
        bytes: b"<p>History</p>".to_vec(),
        content_type: "text/html".into(),
        fragment: None,
        document: Some(Composed {
            tree: parse::html(DeliveredHtml::document("<p>History</p>")),
            usage: CatalogueUsage::Ready {
                instances: vec![],
                slots: vec![],
                ranges: vec![],
            },
            warnings: vec![],
            resources: vec![],
            components: vec![],
            links: vec![],
        }),
    })
}

#[test]
fn the_generation_review_is_compact_and_removed_details_keep_two_space_indentation() {
    let (catalogue, plans) = historical_inputs();
    let mut current = catalogue.clone();
    current.model.entries.clear();
    let mut accepted = historical();
    let result = &mut Arc::get_mut(&mut accepted).unwrap().result;
    result.before = Arc::new(Unimock::new((
        RenderGenerationMock::catalogue
            .each_call(matching!())
            .returns(catalogue),
        RenderGenerationMock::plans
            .each_call(matching!())
            .returns(plans),
        RenderGenerationMock::render
            .each_call(matching!("sample/index.html"))
            .answers_arc(Arc::new(|_, _| Ok(history()))),
    )));
    result.after = Arc::new(Unimock::new((
        RenderGenerationMock::catalogue
            .each_call(matching!())
            .returns(current),
        RenderGenerationMock::generation_key
            .each_call(matching!())
            .returns("after"),
    )));
    let files = comparison_metadata::files(&accepted, &snapshot(Some(accepted.clone()))).unwrap();
    let review = std::str::from_utf8(&files["review.json"].bytes).unwrap();
    assert_eq!(review, compact(&accepted.result.review));
    assert_eq!(review.matches('\n').count(), 1);
    assert!(review.starts_with("{\"affected\":[],\"baseCommit\":\""));
    let detail = std::str::from_utf8(&files["entries/sample.json"].bytes).unwrap();
    assert!(detail.starts_with("{\n  \""), "{detail}");
    assert_eq!(
        detail,
        canonical::to_string(&readers::detail(detail).unwrap()).unwrap()
    );
}
