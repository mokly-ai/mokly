//! A symbolic link in a historical import path cannot bypass head-record validation.

use std::sync::Arc;

use mokly_css::error::CssError;
use mokly_graph::error::{GraphError, Result};
use mokly_graph::types::RenderGeneration;

use super::base_stylesheet_support::{CSS, Fixture, try_generation};
use super::support::{link_directory, unlink_directory};

fn import_failure(result: Result<Arc<dyn RenderGeneration>>) -> Option<(String, String)> {
    let Err(GraphError::Attempt {
        mut failures,
        warnings,
    }) = result
    else {
        return None;
    };
    if !warnings.is_empty() || failures.len() != 1 {
        return None;
    }
    match failures.pop() {
        Some(GraphError::Css {
            source:
                CssError::Import {
                    stylesheet,
                    specifier,
                },
        }) => Some((stylesheet, specifier)),
        _ => None,
    }
}

#[test]
fn a_historical_path_part_symlink_rejects_an_equal_byte_head_record() {
    let fixture = Fixture::with_setup(
        &[
            ("main.css", "@import './styles/link/tokens.css';\n"),
            ("styles/target/tokens.css", CSS),
        ],
        &|head| {
            link_directory(
                &head.root().join("styles/target"),
                &head.root().join("styles/link"),
            );
        },
    );
    unlink_directory(&fixture.head.root().join("styles/link"));
    fixture.head.write("styles/link/tokens.css", CSS);
    let head = fixture.head.generation(fixture.head.prepare().unwrap());
    assert_eq!(
        head.resource("styles/main.css").unwrap().unwrap(),
        CSS.as_bytes()
    );
    let (isolated, isolated_misses) = try_generation(&fixture.base_runtime(false), &fixture.head);
    let (shared, shared_misses) = try_generation(&fixture.base_runtime(true), &fixture.head);
    let isolated_error = isolated.as_ref().err().map(|error| format!("{error:?}"));
    let shared_error = shared.as_ref().err().map(|error| format!("{error:?}"));
    let expected = Some(("main.css".into(), "./styles/link/tokens.css".into()));
    assert_eq!(import_failure(isolated), expected, "{isolated_error:?}");
    assert_eq!(import_failure(shared), expected, "{shared_error:?}");
    assert_eq!(isolated_misses, ["no-record"]);
    assert_eq!(shared_misses, ["stamp-mismatch"]);
}
