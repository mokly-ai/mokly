//! Each call ranks only current prerequisites and tolerates missing records.

use crate::methods::Call;

use super::support::{Loaded, acquire, bindings, describe, maps, pool, render};

#[test]
fn ready_holders_match_call_prerequisites_and_current_binding_identity() {
    for (call, first, second, expected) in [
        (
            Call::CssModules(maps()),
            Loaded::Generation,
            Loaded::Ready,
            0,
        ),
        (describe(), Loaded::Maps, Loaded::Ready, 0),
        (describe(), Loaded::Generation, Loaded::Maps, 1),
        (
            Call::Bindings(bindings()),
            Loaded::Described,
            Loaded::Ready,
            0,
        ),
        (
            Call::Bindings(bindings()),
            Loaded::Maps,
            Loaded::Described,
            1,
        ),
        (render(), Loaded::Described, Loaded::Ready, 1),
        (render(), Loaded::OldBindings, Loaded::Ready, 1),
        (render(), Loaded::Generation, Loaded::OldBindings, 0),
    ] {
        let pool = pool(&[("/head", first), ("/head", second)]);
        assert_eq!(
            acquire(&pool, &call, "/head"),
            expected,
            "call={call:?}, first={first:?}, second={second:?}"
        );
    }
}

#[test]
fn stale_and_missing_records_do_not_win_loaded_state_rank() {
    let stale = pool(&[("/head", Loaded::OldEpoch), ("/head", Loaded::Generation)]);
    assert_eq!(acquire(&stale, &render(), "/head"), 1, "stale epoch");

    for missing in ["epoch", "bundle", "maps", "bindings", "unknown"] {
        let pool = pool(&[("/head", Loaded::Generation), ("/head", Loaded::Ready)]);
        {
            let mut state = pool.lock();
            match missing {
                "epoch" => {
                    state.epochs.clear();
                }
                "bundle" => {
                    state.bundles.clear();
                }
                "maps" => {
                    state.maps.clear();
                }
                "bindings" => {
                    state.bindings.clear();
                }
                "unknown" => {
                    state.epochs.clear();
                    state.bundles.clear();
                    state.maps.clear();
                    state.bindings.clear();
                }
                _ => unreachable!(),
            }
        }
        assert_eq!(acquire(&pool, &render(), "/head"), 0, "missing {missing}");
    }
}
