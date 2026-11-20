//! Bounded inserts and indexed existence queries for share selections.
//!
//! The insert trigger fills the binary `screen_hash` with
//! `sha256(convert_to(screen_path, 'UTF8'))`; a generated column cannot,
//! because Postgres marks `convert_to` stable. The lookup computes the same
//! expression and also compares the full path, so a long path never exceeds
//! an index key and digest equality alone is never trusted.

use diesel::prelude::*;
use diesel::sql_types::{Binary, Text};
use mkc_db::schema::publication_screens::publication_screen_views;
use mkc_domain::ids::PublicationId;
use mkc_store_interface::error::{ErrorResultExt, Result};
use mkc_store_interface::publication_screens::{PublicationScreens, ScreenView, Selection};

use crate::queries::PgQueries;

diesel::define_sql_function! {
    fn sha256(value: Binary) -> Binary;
}

diesel::define_sql_function! {
    fn convert_to(value: Text, encoding: Text) -> Binary;
}

impl PublicationScreens for PgQueries<'_> {
    fn insert_publication_screen_views(
        &mut self,
        publication: PublicationId,
        views: &[ScreenView],
    ) -> Result<()> {
        for chunk in views.chunks(1000) {
            let rows: Vec<_> = chunk
                .iter()
                .map(|view| {
                    (
                        publication_screen_views::publication_id.eq(publication.0),
                        publication_screen_views::screen_path.eq(view.screen_path.as_str()),
                        publication_screen_views::viewport.eq(view.viewport.as_str()),
                        publication_screen_views::scheme.eq(view.scheme.as_str()),
                    )
                })
                .collect();
            diesel::insert_into(publication_screen_views::table)
                .values(rows)
                .execute(self.connection)
                .context("retain validated screen selections")?;
        }
        Ok(())
    }

    fn publication_screen_selection(
        &mut self,
        publication: PublicationId,
        selection: &Selection,
    ) -> Result<bool> {
        let mut query = publication_screen_views::table
            .filter(publication_screen_views::publication_id.eq(publication.0))
            .filter(
                publication_screen_views::screen_hash
                    .eq(sha256(convert_to(&selection.screen_path, "UTF8"))),
            )
            .filter(publication_screen_views::screen_path.eq(&selection.screen_path))
            .into_boxed();
        if let Some(viewport) = selection.viewport {
            query = query.filter(publication_screen_views::viewport.eq(viewport.as_str()));
        }
        if let Some(scheme) = selection.scheme {
            query = query.filter(publication_screen_views::scheme.eq(scheme.as_str()));
        }
        diesel::select(diesel::dsl::exists(query))
            .get_result(self.connection)
            .context("validate stored screen selection")
    }
}
