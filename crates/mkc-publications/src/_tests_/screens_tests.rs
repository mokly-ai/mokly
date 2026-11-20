//! Index screens exercise the shared projection and admission mapping.

use mkc_store_interface::publication_screens::{Scheme, Viewport};

use crate::{screen_observation, screens};

use super::index_fixture;

#[test]
fn current_screens_and_admission_share_the_utf8_identity_boundary() {
    for (id, shareable) in [("a".repeat(2048), true), ("a".repeat(2049), false)] {
        let mut rows = index_fixture::screens().current_screens().to_vec();
        let mut added = rows.pop().unwrap();
        added.path = id.clone();
        added.views.truncate(1);
        rows = vec![added];
        let current = screens::current(&rows);
        let stored = screen_observation::views(&rows);
        assert_eq!(current.len(), usize::from(shareable), "{} bytes", id.len());
        assert_eq!(stored.len(), usize::from(shareable), "{} bytes", id.len());
        if shareable {
            assert_eq!(current[0].path.as_str(), id);
            assert_eq!(stored[0].screen_path.as_str(), id);
        }
    }
}

#[test]
fn shareable_identity_requires_portable_entry_paths_with_the_api_byte_bound() {
    for (id, shareable) in [
        ("Product/Screen_1".into(), true),
        ("a/mokly-generated".into(), true),
        ("node_modules/_Screen-1".into(), true),
        ("com10/lpt0".into(), true),
        ("é".repeat(1024), false),
        (format!("{}a", "é".repeat(1024)), false),
        (String::new(), false),
        ("screen\n".into(), false),
        ("/a".into(), false),
        ("a/".into(), false),
        ("a//b".into(), false),
        ("a.b".into(), false),
        ("a%2fb".into(), false),
        ("a\\b".into(), false),
        ("a b".into(), false),
        ("Mokly-Generated/a".into(), false),
    ] {
        assert_eq!(screens::shareable_identity(&id), shareable);
    }
    for name in ["aux", "con", "nul", "prn"]
        .into_iter()
        .map(str::to_owned)
        .chain((1..=9).flat_map(|index| [format!("com{index}"), format!("lpt{index}")]))
    {
        assert!(!screens::shareable_identity(&format!(
            "a/{}",
            name.to_uppercase()
        )));
    }
}

#[test]
fn current_screens_and_admission_selections_agree() {
    let index = index_fixture::screens();
    let screens = screens::current(index.current_screens());
    assert_eq!(
        screens
            .iter()
            .map(|s| (s.path.as_str(), s.title))
            .collect::<Vec<_>>(),
        [
            ("a-kept", "Kept screen"),
            ("mixed", "Mixed views"),
            ("z-new", "New screen"),
        ]
    );
    let observed = screen_observation::views(index.current_screens());
    assert_eq!(
        observed
            .iter()
            .map(|v| (v.screen_path.as_str(), v.viewport, v.scheme))
            .collect::<Vec<_>>(),
        [
            ("a-kept", Viewport::Desktop, Scheme::Light),
            ("a-kept", Viewport::Mobile, Scheme::Light),
            ("mixed", Viewport::Desktop, Scheme::Light),
            ("mixed", Viewport::Desktop, Scheme::Dark),
            ("z-new", Viewport::Mobile, Scheme::Light),
        ]
    );
}
