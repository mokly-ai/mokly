//! Share selections validate the stored pair and hide unavailable inventories.

use mkc_mokly_contract::index_values::{ColorScheme, Viewport};
use mkc_store_interface::publication_screens::{self, PublicationScreensMock};
use unimock::{MockFn, Unimock, matching};

use crate::platform::error::Error;
use crate::viewer::input::Selection;
use crate::viewer::share_validation::ShareValidation;

use super::support::{PUBLICATION, publication};

#[test]
fn canonical_sharing_checks_one_persisted_screen_view() {
    for valid in [true, false] {
        let mut queries = Unimock::new(
            PublicationScreensMock::publication_screen_selection
                .next_call(matching!((id, selection) if *id == PUBLICATION
                    && selection.screen_path == "start"
                    && selection.viewport == Some(publication_screens::Viewport::Mobile)
                    && selection.scheme == Some(publication_screens::Scheme::Dark)))
                .returns(Ok(valid)),
        );
        let selection = Selection {
            screen: Some("start".parse().unwrap()),
            viewport: Some(Viewport::Mobile),
            scheme: Some(ColorScheme::Dark),
        };
        let validator: &dyn ShareValidation = &selection;
        let result = validator.validate(&mut queries, &publication(true));
        if valid {
            assert!(result.is_ok());
        } else {
            assert!(matches!(result, Err(Error::InvalidInput)));
        }
    }
}

#[test]
fn no_comparison_shares_require_no_file_or_selection_query() {
    let mut queries = Unimock::new(());
    let mut selection = Selection::default();
    assert!(
        selection
            .validate(&mut queries, &publication(false))
            .is_ok()
    );
    selection.screen = Some("start".parse().unwrap());
    assert!(matches!(
        selection.validate(&mut queries, &publication(false)),
        Err(Error::OperationUnavailable)
    ));
}
