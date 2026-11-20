//! Signature integrity and producer-owned deep-link escaping.

use crate::capability::{Capability, CapabilityFactory, HmacCapabilityFactory};
use crate::locations::branch_alias;

use super::support::{PROJECT, PUBLICATION, USER, locations, now, organization_slug, project_slug};

#[test]
fn capabilities_reject_tampering_truncation_and_another_signing_key() {
    let signer = HmacCapabilityFactory.create(&"a".repeat(64)).unwrap();
    let other = HmacCapabilityFactory.create(&"b".repeat(64)).unwrap();
    let claim = Capability {
        publication: PUBLICATION,
        user: USER,
        expires: now().timestamp(),
    };
    let signed = signer.sign(claim).unwrap();
    assert_eq!(signer.verify(&signed).unwrap(), claim);
    assert!(other.verify(&signed).is_err());
    for forged in [
        signed.replace("v1", "v2"),
        signed[..signed.len() - 1].to_owned(),
        format!("{signed}0"),
        "x".repeat(257),
        String::new(),
    ] {
        assert!(signer.verify(&forged).is_err());
    }
    assert!(HmacCapabilityFactory.create("aa").is_err());
    assert!(HmacCapabilityFactory.create(&"z".repeat(64)).is_err());
}

#[test]
fn locations_keep_selection_in_one_query_value_and_branches_in_one_dns_label() {
    let url = locations()
        .viewer(
            &organization_slug(),
            &project_slug(),
            PUBLICATION,
            Some("x&view=browse/#)"),
        )
        .unwrap();
    let url = url::Url::parse(&url).unwrap();
    assert_eq!(
        url.query_pairs().collect::<Vec<_>>(),
        vec![
            ("view".into(), "changes".into()),
            ("catalogueScreen".into(), "x&view=browse/#)".into())
        ]
    );
    let alias = branch_alias(PROJECT, "feature/a.b_日本語");
    assert_eq!(alias.len(), 42);
    assert_ne!(alias, branch_alias(PROJECT, "feature/a.b_日本語x"));
}
