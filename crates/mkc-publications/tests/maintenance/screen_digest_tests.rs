//! Stored selection digests and query operands agree on SHA-256 of UTF-8 bytes.

use diesel::prelude::*;
use diesel::sql_types::{Text, Uuid};
use mkc_domain::blob::BlobHash;
use mkc_store_interface::publication::PublicationState;
use mkc_store_interface::publication_screens::{Scheme, ScreenView, Selection, Viewport};
use mkc_store_interface::store::Callback;

use super::fixtures::{project, publication, store};

#[derive(QueryableByName)]
struct Digest {
    #[diesel(sql_type = Text)]
    digest: String,
}

#[test]
fn screen_lookup_uses_sha256_utf8_digests() {
    let Some((store, schema)) = store() else {
        return;
    };
    let project = project(store.as_ref());
    let mut row = publication(&project, PublicationState::Validating, 0, "feature");
    let metadata = row.metadata.as_mut().unwrap();
    metadata.base_ref = Some("main".into());
    metadata.base_sha = Some("a".repeat(40));
    for screen in ["start", "Product/Screen_1"] {
        store
            .transaction(&mut Callback(&mut |q| {
                if screen == "start" {
                    q.insert_publication(&row)?;
                }
                q.insert_publication_screen_views(
                    row.id,
                    &[ScreenView {
                        screen_path: screen.parse().unwrap(),
                        viewport: Viewport::Desktop,
                        scheme: Scheme::Light,
                    }],
                )?;
                assert!(q.publication_screen_selection(
                    row.id,
                    &Selection {
                        screen_path: screen.into(),
                        viewport: None,
                        scheme: None,
                    }
                )?);
                Ok(())
            }))
            .unwrap();
        let digest = diesel::sql_query(
            "SELECT encode(screen_hash::bytea, 'hex') AS digest \
            FROM publication_screen_views WHERE screen_path = $1",
        )
        .bind::<Text, _>(screen)
        .get_result::<Digest>(&mut schema.connection())
        .unwrap();
        assert_eq!(
            digest.digest,
            BlobHash::digest(screen.as_bytes()).to_string()
        );
    }
    let multibyte = "screen-é";
    assert!(multibyte.len() > multibyte.chars().count());
    diesel::sql_query(
        "INSERT INTO publication_screen_views \
         (publication_id, screen_path, viewport, scheme) \
         VALUES ($1, $2, 'desktop', 'light')",
    )
    .bind::<Uuid, _>(row.id.0)
    .bind::<Text, _>(multibyte)
    .execute(&mut schema.connection())
    .unwrap();
    store
        .read(&mut Callback(&mut |q| {
            assert!(q.publication_screen_selection(
                row.id,
                &Selection {
                    screen_path: multibyte.into(),
                    viewport: None,
                    scheme: None,
                }
            )?);
            Ok(())
        }))
        .unwrap();
    let digest = diesel::sql_query(
        "SELECT encode(screen_hash::bytea, 'hex') AS digest \
         FROM publication_screen_views WHERE screen_path = $1",
    )
    .bind::<Text, _>(multibyte)
    .get_result::<Digest>(&mut schema.connection())
    .unwrap();
    assert_eq!(
        digest.digest,
        BlobHash::digest(multibyte.as_bytes()).to_string()
    );
}
