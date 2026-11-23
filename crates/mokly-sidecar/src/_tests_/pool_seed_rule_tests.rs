//! A released recipe that a changed current source rules out is not sent before a bundle.

use std::io::{Error, ErrorKind};
use std::path::Path;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::bundle_outcomes::CacheOutcome;
use crate::methods::BundleCapture;
use crate::pool::SidecarPool;
use crate::source_digests::SourceDigestsMock;

use super::recipe_support::Fixture;

const EDIT: BundleCapture = BundleCapture::ServeEdit;
const SCREEN: &str = "/repo/screen.ts";
const SHARED: &str = "/repo/shared.ts";

#[derive(Clone, Copy, Debug)]
enum Current {
    Digest(&'static str),
    Missing,
    Unreadable,
}

struct Sources {
    fixture: Fixture,
    reads: Arc<Mutex<Vec<String>>>,
    /// What the released recipe records for `SCREEN`: a digest, or `None` for an absence.
    released_screen: Option<&'static str>,
}

impl Sources {
    fn new(current: Current) -> Self {
        let reads = Arc::new(Mutex::new(Vec::new()));
        let log = reads.clone();
        let digests = Unimock::new(
            SourceDigestsMock::digest
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, path| {
                    log.lock().unwrap().push(path.display().to_string());
                    match current {
                        _ if path != Path::new(SCREEN) => Ok(Some("shared".into())),
                        Current::Digest(digest) => Ok(Some(digest.into())),
                        Current::Missing => Ok(None),
                        Current::Unreadable => Err(Error::from(ErrorKind::PermissionDenied)),
                    }
                })),
        )
        .no_verify_in_drop();
        Self {
            fixture: Fixture::with_digests(usize::MAX, Arc::new(digests)),
            reads,
            released_screen: Some("released"),
        }
    }

    /// Make the released recipe record `SCREEN` as absent.
    fn recording_absence(mut self) -> Self {
        self.released_screen = None;
        self
    }

    /// Release `released` and keep `live` live, both with the settings of `entry`.
    fn edits(self, entry: &str, released: &str, live: Option<&str>) -> Self {
        self.edits_with(entry, released, live, EDIT)
    }

    /// As `edits`, with the released compilation bundled with `capture`.
    fn edits_with(
        self,
        entry: &str,
        released: &str,
        live: Option<&str>,
        capture: BundleCapture,
    ) -> Self {
        self.fixture.record_inputs(
            released,
            &[(SCREEN, self.released_screen), (SHARED, Some("shared"))],
        );
        self.fixture.record_inputs(
            &format!("{released}-live"),
            &[(SCREEN, live), (SHARED, Some("shared"))],
        );
        let first = self.fixture.bundle_with_capture(entry, released, capture);
        self.fixture
            .pool
            .release_generation(&first.generation, first.epoch);
        self.fixture.pool.synchronize_releases();
        self.fixture
            .bundle_with_capture(entry, &format!("{released}-live"), EDIT);
        self.reads.lock().unwrap().clear();
        self
    }

    fn reads(&self) -> Vec<String> {
        std::mem::take(&mut *self.reads.lock().unwrap())
    }
}

#[test]
fn a_forward_edit_sends_no_released_recipe_that_a_changed_source_rules_out() {
    let sources =
        Sources::new(Current::Digest("edited")).edits("screen.ts", "released", Some("live"));
    let (restored, cache) = sources.fixture.probe_outcome("screen.ts", "probe", 2, EDIT);
    assert_eq!(restored, ["released-live"]);
    assert_eq!(
        sources.reads(),
        [SCREEN],
        "only the path whose digests differ is read, once"
    );
    assert_eq!(cache, Some(CacheOutcome::StampMismatch));
}

#[test]
fn a_file_created_where_the_released_recipe_records_an_absence_rules_it_out() {
    let sources = Sources::new(Current::Digest("created"))
        .recording_absence()
        .edits("screen.ts", "released", Some("live"));
    let (restored, cache) = sources.fixture.probe_outcome("screen.ts", "probe", 2, EDIT);
    assert_eq!(restored, ["released-live"]);
    assert_eq!(sources.reads(), [SCREEN]);
    assert_eq!(cache, Some(CacheOutcome::StampMismatch));
}

#[test]
fn a_source_still_missing_where_the_released_recipe_records_an_absence_keeps_it() {
    let sources = Sources::new(Current::Missing).recording_absence().edits(
        "screen.ts",
        "released",
        Some("live"),
    );
    let (restored, cache) = sources.fixture.probe_outcome("screen.ts", "probe", 2, EDIT);
    assert_eq!(restored, ["released", "released-live"]);
    assert_eq!(sources.reads(), [SCREEN]);
    assert_eq!(cache, Some(CacheOutcome::StampMismatch));
}

#[test]
fn a_ruled_out_recipe_keeps_stamp_mismatch_when_no_live_compilation_can_serve() {
    let sources = Sources::new(Current::Digest("edited")).edits_with(
        "screen.ts",
        "released",
        Some("live"),
        BundleCapture::Full,
    );
    let (restored, cache) =
        sources
            .fixture
            .probe_outcome("screen.ts", "probe", 2, BundleCapture::Full);
    assert_eq!(
        restored,
        Vec::<String>::new(),
        "a full request cannot reuse the live serveEdit compilation"
    );
    assert_eq!(sources.reads(), [SCREEN]);
    assert_eq!(
        cache,
        Some(CacheOutcome::StampMismatch),
        "the ruled-out recipe still counts as a reusable compilation"
    );
}

#[test]
fn a_revert_to_the_released_content_still_sends_the_released_recipe() {
    let sources =
        Sources::new(Current::Digest("released")).edits("screen.ts", "released", Some("live"));
    let (restored, cache) = sources.fixture.probe_outcome("screen.ts", "probe", 2, EDIT);
    assert_eq!(restored, ["released", "released-live"]);
    assert_eq!(sources.reads(), [SCREEN]);
    assert_eq!(cache, Some(CacheOutcome::StampMismatch));
}

#[test]
fn equal_digests_in_both_recipes_keep_the_released_recipe_without_a_read() {
    let sources =
        Sources::new(Current::Digest("edited")).edits("screen.ts", "released", Some("released"));
    let (restored, cache) = sources.fixture.probe_outcome("screen.ts", "probe", 2, EDIT);
    assert_eq!(restored, ["released", "released-live"]);
    assert_eq!(sources.reads(), Vec::<String>::new());
    assert_eq!(cache, Some(CacheOutcome::StampMismatch));
}

#[test]
fn a_missing_or_unreadable_source_keeps_the_released_recipe() {
    for current in [Current::Missing, Current::Unreadable] {
        let sources = Sources::new(current).edits("screen.ts", "released", Some("live"));
        let (restored, cache) = sources.fixture.probe_outcome("screen.ts", "probe", 2, EDIT);
        assert_eq!(restored, ["released", "released-live"], "{current:?}");
        assert_eq!(sources.reads(), [SCREEN], "{current:?}");
        assert_eq!(cache, Some(CacheOutcome::StampMismatch), "{current:?}");
    }
}

#[test]
fn a_ruled_out_recipe_keeps_its_place_in_the_least_recently_used_order() {
    let sources = Sources::new(Current::Digest("edited")).edits("a.ts", "a", Some("live"));
    let sources = sources.edits("b.ts", "b", Some("live"));
    assert_eq!(
        sources.fixture.probe_outcome("a.ts", "probe-a", 2, EDIT).0,
        ["a-live"]
    );
    {
        let mut state = sources.fixture.pool.lock();
        let bytes = state.recipes.bytes;
        state.recipes.bound = bytes;
    }
    let sources = sources.edits("c.ts", "c", Some("live"));
    let retained: Vec<String> = sources
        .fixture
        .pool
        .lock()
        .recipes
        .entries
        .iter()
        .map(|recipe| recipe.reusable.compiled().identity.clone())
        .collect();
    assert_eq!(
        retained,
        ["a", "c"],
        "the probe of a touched it, so b was the least recently used"
    );
}
