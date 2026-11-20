//! Contract tests for the generated email documents.

use mkc_email_templates::templates::{Kind, get};

#[test]
fn both_documents_have_their_required_placeholders_and_brands() {
    for (kind, expected) in [
        (Kind::SignIn, ["link", "expiry"].as_slice()),
        (
            Kind::Invitation,
            ["link", "expiry", "organization", "invitedBy"].as_slice(),
        ),
    ] {
        let template = get(kind);
        assert!(template.subject.ends_with('\n'));
        assert!(template.html.starts_with("<!doctype html>\n"));
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
        for name in expected {
            let token = format!("{{{{{name}}}}}");
            assert!(template.html.contains(&token), "{name} absent from HTML");
        }
        assert!(template.text.contains("{{{link}}}"));
        assert!(template.html.contains("href=\"{{link}}\""));
    }
}
