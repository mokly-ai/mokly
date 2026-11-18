//! Count provenance survives normalization for default and exact pools.

use crate::grammar::SidecarSource;
use crate::options::{Environment, validate};
use crate::parsing::parse;

#[test]
fn sidecar_count_preserves_default_and_exact_override_provenance() {
    for (arguments, environment_count, count, source) in [
        (vec!["mokly"], None, 4, SidecarSource::Default),
        (
            vec!["mokly", "--sidecars=7"],
            None,
            7,
            SidecarSource::Explicit,
        ),
        (vec!["mokly"], Some("8"), 8, SidecarSource::Explicit),
        (
            vec!["mokly", "--sidecars=7"],
            Some("8"),
            7,
            SidecarSource::Explicit,
        ),
    ] {
        let mut cli = parse(
            &arguments
                .iter()
                .map(|value| (*value).into())
                .collect::<Vec<_>>(),
        )
        .unwrap();
        validate(
            &mut cli,
            &Environment {
                cores: 4,
                sidecars: environment_count.map(str::to_owned),
                ..Environment::default()
            },
        )
        .unwrap();
        assert_eq!(cli.common().sidecars, Some(count), "{arguments:?}");
        assert_eq!(cli.common().sidecar_source, source, "{arguments:?}");
    }
}
