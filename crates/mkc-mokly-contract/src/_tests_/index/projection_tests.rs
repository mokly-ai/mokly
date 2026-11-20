//! Check links and current screen selections retain index order and authored text.

use crate::index_records::ViewAxes;
use crate::index_values::{ColorScheme, Viewport};

use super::support::{parse, valid};

#[test]
fn counted_records_and_screens_keep_the_published_order_and_titles() {
    let index = parse(&valid()).unwrap();
    assert_eq!(
        index
            .counted_records()
            .iter()
            .map(|record| (record.path.as_str(), record.title.as_str()))
            .collect::<Vec<_>>(),
        [
            ("product", "Product overview"),
            ("product/browse/details", "Details"),
            ("product/browse/home", "Home"),
            ("product/removed-page", "Removed page"),
            ("product/browse/home/retired", "Removed screen"),
        ]
    );
    assert_eq!(index.changes_count().unwrap().total(), 5);
    assert_eq!(
        index
            .current_screens()
            .iter()
            .map(|screen| (screen.path.as_str(), screen.title.as_str()))
            .collect::<Vec<_>>(),
        [
            ("product/browse/details", "Details"),
            ("product/browse/home", "Home"),
            ("product/browse/home/empty", "Empty"),
        ]
    );
    assert_eq!(
        index.current_screens()[0].views,
        [
            ViewAxes {
                viewport: Viewport::Mobile,
                color_scheme: ColorScheme::Light
            },
            ViewAxes {
                viewport: Viewport::Desktop,
                color_scheme: ColorScheme::Light
            },
        ]
    );
}
