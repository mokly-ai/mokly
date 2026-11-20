//! Hosted send models must cover exactly the generated template placeholders.

#![allow(clippy::unwrap_used)]

use std::collections::BTreeSet;

use mkc_email_postmark::model::{InvitationModel, SignInModel, TemplateModel};
use mkc_email_templates::templates::{Kind, get};

fn placeholders(text: &str, unescaped: bool) -> BTreeSet<String> {
    let mut found = BTreeSet::new();
    let mut remainder = text;
    while let Some((_, after_open)) = remainder.split_once("{{") {
        let (raw_name, after_close) = after_open.split_once("}}").unwrap();
        let (name, after_close) = if unescaped {
            (
                raw_name.strip_prefix('{').unwrap(),
                after_close.strip_prefix('}').unwrap(),
            )
        } else {
            assert!(!raw_name.starts_with('{'));
            (raw_name, after_close)
        };
        assert!(name.chars().all(|c| c.is_ascii_alphanumeric()));
        found.insert(name.to_owned());
        remainder = after_close;
    }
    found
}

#[test]
fn each_hosted_model_covers_the_exact_committed_placeholder_set() {
    let cases = [
        (
            Kind::SignIn,
            TemplateModel::SignIn(SignInModel {
                link: String::new(),
                expiry: String::new(),
                site_origin: String::new(),
            }),
        ),
        (
            Kind::Invitation,
            TemplateModel::Invitation(InvitationModel {
                link: String::new(),
                organization: String::new(),
                invited_by: String::new(),
                expiry: String::new(),
                site_origin: String::new(),
            }),
        ),
    ];
    for (kind, model) in cases {
        let template = get(kind);
        let subject = placeholders(template.subject, true);
        let html = placeholders(template.html, false);
        let text = placeholders(template.text, true);
        let used = subject.union(&html).cloned().collect::<BTreeSet<_>>();
        let used = used.union(&text).cloned().collect::<BTreeSet<_>>();
        let model = serde_json::to_value(model).unwrap();
        let keys = model.as_object().unwrap().keys().cloned().collect();
        assert_eq!(used, keys, "{} model drift", kind.alias());
        let (expected_subject, expected_html, expected_text): (&[&str], &[&str], &[&str]) =
            match kind {
                Kind::SignIn => (&[], &["link", "expiry", "siteOrigin"], &["link", "expiry"]),
                Kind::Invitation => (
                    &["organization"],
                    &["link", "expiry", "organization", "invitedBy", "siteOrigin"],
                    &["link", "expiry", "organization", "invitedBy"],
                ),
            };
        assert_eq!(
            subject,
            expected_subject
                .iter()
                .map(|name| (*name).to_owned())
                .collect()
        );
        assert_eq!(
            html,
            expected_html
                .iter()
                .map(|name| (*name).to_owned())
                .collect()
        );
        assert_eq!(
            text,
            expected_text
                .iter()
                .map(|name| (*name).to_owned())
                .collect()
        );
        assert!(template.html.contains("href=\"{{link}}\""));
        assert!(
            template
                .html
                .contains("{{siteOrigin}}/brand/mokly-logo-light.png")
        );
        assert!(
            template
                .html
                .contains("{{siteOrigin}}/brand/mokly-logo-dark.png")
        );
    }
}

#[test]
fn runtime_aliases_match_the_deployment_sync_aliases() {
    let sync = include_str!("../../../infra/scripts/sync-postmark-templates.mjs");
    for kind in [Kind::SignIn, Kind::Invitation] {
        assert!(sync.contains(&format!("alias: \"{}\"", kind.alias())));
    }
}
