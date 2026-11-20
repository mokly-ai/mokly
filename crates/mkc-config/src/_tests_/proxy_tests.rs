//! Proxy path spoofing, malformed chains and configuration seams.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::net::IpAddr;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::proxy::{ProxyConfig, TrustedProxies};
use crate::settings::{EnvironmentConfig, EnvironmentMock, Error};

fn policy(hops: u8) -> TrustedProxies {
    TrustedProxies {
        hops,
        networks: vec!["10.0.0.0/8".parse().unwrap(), "fd00::/8".parse().unwrap()],
    }
}

#[test]
fn zero_hops_ignores_attacker_supplied_headers() {
    let peer = "192.0.2.10".parse().unwrap();
    assert_eq!(policy(0).client_ip(peer, Some("198.51.100.1")), peer);
}

#[test]
fn walks_only_the_configured_trusted_suffix() {
    let peer = "10.0.0.1".parse().unwrap();
    let chain = Some("203.0.113.99, 192.0.2.7, fd00::2, 10.0.0.3");
    let expected: IpAddr = "192.0.2.7".parse().unwrap();
    assert_eq!(policy(3).client_ip(peer, chain), expected);
    assert_eq!(policy(4).client_ip(peer, chain), peer);
}

#[test]
fn missing_short_malformed_or_untrusted_chains_fall_back_to_peer() {
    let peer = "10.0.0.1".parse().unwrap();
    for chain in [
        None,
        Some("192.0.2.1"),
        Some("192.0.2.1, unknown"),
        Some("192.0.2.1, 198.51.100.1"),
        Some("192.0.2.1, 10.0.0.2:80"),
        Some("192.0.2.1, "),
    ] {
        assert_eq!(policy(2).client_ip(peer, chain), peer);
    }
    let untrusted = "198.51.100.1".parse().unwrap();
    assert_eq!(policy(1).client_ip(untrusted, Some("192.0.2.1")), untrusted);
    assert_eq!(policy(1).client_ip(peer, Some(&"1".repeat(4097))), peer);
}

fn load(hops: Option<&'static str>, cidrs: Option<&'static str>) -> EnvironmentConfig {
    EnvironmentConfig {
        environment: Arc::new(Unimock::new(
            EnvironmentMock::get
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, key| match key {
                    "MKC_TRUSTED_PROXY_HOPS" => hops.map(str::to_owned),
                    "MKC_TRUSTED_PROXY_CIDRS" => cidrs.map(str::to_owned),
                    _ => panic!("unexpected environment key"),
                })),
        )),
    }
}

#[test]
fn invalid_proxy_config_is_typed_and_default_is_disabled() {
    assert_eq!(load(None, None).proxies().unwrap().hops, 0);
    for value in ["", "-1", "17", "1.5", "a"] {
        assert!(matches!(
            load(Some(value), None).proxies(),
            Err(Error::Invalid("MKC_TRUSTED_PROXY_HOPS"))
        ));
    }
    for value in [None, Some(""), Some("not-a-network")] {
        assert!(matches!(
            load(Some("2"), value).proxies(),
            Err(Error::Invalid("MKC_TRUSTED_PROXY_CIDRS"))
        ));
    }
    assert_eq!(
        load(Some("2"), Some("10.0.0.0/8, fd00::/8"))
            .proxies()
            .unwrap()
            .networks
            .len(),
        2
    );
}
