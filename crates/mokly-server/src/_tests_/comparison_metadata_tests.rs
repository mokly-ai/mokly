//! A classification generation holds removed details with two-space indentation and no review file.

use std::sync::Arc;

use mokly_graph::types::RenderGenerationMock;
use mokly_model::{canonical, readers};
use unimock::{MockFn, Unimock, matching};

use crate::comparison_metadata;
use crate::comparison_support::{historical, historical_inputs, history, snapshot};

#[test]
fn the_generation_has_no_review_file_and_removed_details_keep_two_space_indentation() {
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
    assert_eq!(
        files.keys().collect::<Vec<_>>(),
        ["entries/sample.json", "previews/sample/index.json"]
    );
    let detail = std::str::from_utf8(&files["entries/sample.json"].bytes).unwrap();
    assert!(detail.starts_with("{\n  \""), "{detail}");
    assert_eq!(
        detail,
        canonical::to_string(&readers::detail(detail).unwrap()).unwrap()
    );
}
