//! Build deny coverage and canonical deployment additions.

#![allow(clippy::unwrap_used)]

use sandbox_interface::EgressDestination;

use crate::policy::denied_destinations;

#[test]
fn adds_all_missing_adapter_ranges_without_denying_mapped_public_ipv4() {
    let rules = denied_destinations(&[]).unwrap();
    assert_eq!(
        rules,
        ["0.0.0.0/8", "240.0.0.0/4", "64:ff9b::/96", "ff00::/8"]
    );
    assert!(!rules.iter().any(|rule| rule == "::ffff:0:0/96"));
    let mut final_rules = rules;
    final_rules.extend(
        [
            "10.0.0.0/8",
            "100.64.0.0/10",
            "127.0.0.0/8",
            "169.254.0.0/16",
            "172.16.0.0/12",
            "192.168.0.0/16",
            "224.0.0.0/4",
            "::1/128",
            "fc00::/7",
            "fe80::/10",
        ]
        .map(str::to_owned),
    );
    final_rules.sort();
    assert_eq!(
        final_rules,
        [
            "0.0.0.0/8",
            "10.0.0.0/8",
            "100.64.0.0/10",
            "127.0.0.0/8",
            "169.254.0.0/16",
            "172.16.0.0/12",
            "192.168.0.0/16",
            "224.0.0.0/4",
            "240.0.0.0/4",
            "64:ff9b::/96",
            "::1/128",
            "fc00::/7",
            "fe80::/10",
            "ff00::/8"
        ]
    );
}

#[test]
fn canonicalizes_and_deduplicates_ip_and_cidr_additions() {
    let addition = EgressDestination::Cidr {
        address: "203.0.113.15".parse().unwrap(),
        prefix: 24,
    };
    let mapped = EgressDestination::Ip("::ffff:203.0.113.1".parse().unwrap());
    let rules = denied_destinations(&[addition.clone(), addition, mapped]).unwrap();
    assert_eq!(
        rules,
        [
            "0.0.0.0/8",
            "203.0.113.0/24",
            "203.0.113.1",
            "240.0.0.0/4",
            "64:ff9b::/96",
            "ff00::/8"
        ]
    );
}

#[test]
fn rejects_domains_invalid_prefixes_and_more_than_32_raw_entries() {
    assert!(denied_destinations(&[EgressDestination::Domain("example.com".into())]).is_err());
    assert!(
        denied_destinations(&[EgressDestination::Cidr {
            address: "127.0.0.1".parse().unwrap(),
            prefix: 33
        }])
        .is_err()
    );
    let ip = EgressDestination::Ip("203.0.113.1".parse().unwrap());
    assert!(denied_destinations(&vec![ip.clone(); 32]).is_ok());
    assert!(denied_destinations(&vec![ip; 33]).is_err());
}
