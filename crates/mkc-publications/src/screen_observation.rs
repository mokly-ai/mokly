//! Current comparison views retained at admission for canonical sharing.

use mkc_mokly_contract::index_records::Screen;
use mkc_mokly_contract::index_values;
use mkc_store_interface::publication_screens::{Scheme, ScreenView, Viewport};

use crate::screens;

pub(crate) fn views(records: &[Screen]) -> Vec<ScreenView> {
    screens::current(records)
        .into_iter()
        .flat_map(|screen| {
            screen.views.into_iter().map(move |view| ScreenView {
                screen_path: screen.path.clone(),
                viewport: match view.viewport {
                    index_values::Viewport::Desktop => Viewport::Desktop,
                    index_values::Viewport::Mobile => Viewport::Mobile,
                },
                scheme: match view.color_scheme {
                    index_values::ColorScheme::Light => Scheme::Light,
                    index_values::ColorScheme::Dark => Scheme::Dark,
                },
            })
        })
        .collect()
}
