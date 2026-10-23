//! Real catalogue issues have the exact watched location and code layout.

use mokly_catalogue::diagnostic::{Code, Issue};
use mokly_catalogue::error::CatalogueError;
use mokly_model::catalogue::SourceLocation;

use crate::build::BuildError;
use crate::output::{Mode, Style};
use crate::redaction::Redactor;
use crate::watch_diagnostics::diagnostics;

#[test]
fn invalid_catalogue_issues_print_the_location_before_their_own_code() {
    let failure = BuildError::Catalogue {
        source: CatalogueError::Invalid {
            warnings: vec![],
            issues: vec![Issue::new(Code::HtmlElement, "unknown element ui-hero").at(
                SourceLocation {
                    path: "specs/home.screen.html".into(),
                    line: 12,
                    column: 5,
                    export: None,
                },
            )],
        },
    };
    let style = Style {
        mode: Mode::Plain,
        color: false,
        ascii: false,
        columns: 200,
    };
    assert_eq!(
        diagnostics(&style, &failure, &Redactor::default()),
        "specs/home.screen.html:12:5 [mokly/html-element] unknown element ui-hero\n"
    );
}
