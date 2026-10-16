//! Inner diagnostic tags are omitted only when the outer code is the same.

use std::path::Path;

use mokly_catalogue::diagnostic::{self, Issue};
use mokly_catalogue::error::CatalogueError;

use crate::build::BuildError;
use crate::build_output::failure;
use crate::output::{Mode, Style};
use crate::redaction::Redactor;

#[test]
fn configuration_tags_survive_inside_build_failures() {
    for mode in [Mode::Plain, Mode::Rich] {
        let style = Style {
            mode,
            color: false,
            ascii: false,
            columns: 200,
        };
        let issue = || {
            Issue::new(
                diagnostic::Code::ConfigInvalid,
                "invalid inventoried source bad",
            )
        };
        let build = BuildError::Catalogue {
            source: CatalogueError::Invalid {
                issues: vec![issue()],
                warnings: Vec::new(),
            },
        };
        let text = failure(&style, &build, &Redactor::default(), Path::new("/repo"));
        assert!(text.contains("[mokly/build-invalid]"), "{text}");
        assert!(
            text.contains("[mokly/config-invalid] invalid inventoried source bad"),
            "{text}"
        );
        let config = BuildError::Catalogue {
            source: CatalogueError::Config(issue()),
        };
        let text = failure(&style, &config, &Redactor::default(), Path::new("/repo"));
        assert_eq!(text.matches("[mokly/config-invalid]").count(), 1, "{text}");
        if mode == Mode::Plain {
            assert_eq!(
                text,
                "[mokly/config-invalid] invalid inventoried source bad\n"
            );
        }
    }
}
