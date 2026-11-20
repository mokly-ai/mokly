//! Recorded Postmark responses over a real loopback HTTP transport.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use mkc_email_interface::mail::{Content, Lifetime, Mailer, Message};
use mkc_email_postmark::delivery::PostmarkMailer;
use mkc_email_postmark::transport::{PostmarkHttpFactory, TransportFactory};
use serde_json::{Value, json};

fn recorded(status: &str, body: &'static str) -> (Arc<dyn Mailer>, thread::JoinHandle<String>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let endpoint = format!(
        "http://{}/email/withTemplate",
        listener.local_addr().unwrap()
    );
    let status = status.to_owned();
    let handle = thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        stream
            .set_read_timeout(Some(Duration::from_secs(5)))
            .unwrap();
        let mut data = Vec::new();
        loop {
            let mut buffer = [0; 1024];
            let count = stream.read(&mut buffer).unwrap();
            if count == 0 {
                break;
            }
            data.extend_from_slice(&buffer[..count]);
            if let Some(end) = data.windows(4).position(|bytes| bytes == b"\r\n\r\n") {
                let headers = String::from_utf8_lossy(&data[..end]);
                let length = headers
                    .lines()
                    .find_map(|line| {
                        line.to_ascii_lowercase()
                            .strip_prefix("content-length: ")
                            .map(|v| v.parse::<usize>().unwrap())
                    })
                    .unwrap();
                if data.len() >= end + 4 + length {
                    break;
                }
            }
        }
        write!(stream, "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).unwrap();
        String::from_utf8(data).unwrap()
    });
    (
        Arc::new(PostmarkMailer {
            from: "sender@example.com".to_owned(),
            site_origin: "https://site.example.com".to_owned(),
            transport: PostmarkHttpFactory
                .build(endpoint, "recorded-test-token".to_owned())
                .unwrap(),
        }),
        handle,
    )
}

fn request_body(request: &str) -> Value {
    let (_, body) = request.split_once("\r\n\r\n").unwrap();
    serde_json::from_str(body).unwrap()
}

#[test]
fn sign_in_uses_the_hosted_template_and_typed_model() {
    let (mailer, server) = recorded("200 OK", include_str!("fixtures/success.json"));
    mailer
        .send(&Message {
            recipient: "receiver@example.com".to_owned(),
            content: Content::SignIn {
                link: "https://app.example.com/auth/email/callback#token=fixture".to_owned(),
                valid_for: Lifetime::Minutes(15),
            },
        })
        .unwrap();
    let request = server.join().unwrap();
    assert!(request.starts_with("POST /email/withTemplate HTTP/1.1"));
    assert!(
        request
            .to_lowercase()
            .contains("x-postmark-server-token: recorded-test-token")
    );
    let body = request_body(&request);
    assert_eq!(body["TemplateAlias"], "mokly-sign-in");
    assert_eq!(
        body["TemplateModel"],
        json!({
            "link": "https://app.example.com/auth/email/callback#token=fixture",
            "expiry": "15 minutes",
            "siteOrigin": "https://site.example.com"
        })
    );
    assert_eq!(body["To"], "receiver@example.com");
    assert_eq!(body["From"], "sender@example.com");
    assert_eq!(body["InlineCss"], false);
    assert_eq!(body["TrackOpens"], false);
    assert_eq!(body["TrackLinks"], "None");
    assert_eq!(body["MessageStream"], "outbound");
    for field in ["Subject", "HtmlBody", "TextBody", "TemplateId"] {
        assert!(body.get(field).is_none(), "{field} must come from Postmark");
    }
}

#[test]
fn invitation_model_uses_stored_names_without_app_side_html_escaping() {
    let (mailer, server) = recorded("200 OK", include_str!("fixtures/success.json"));
    mailer
        .send(&Message {
            recipient: "invited@example.com".to_owned(),
            content: Content::Invitation {
                link: "https://app.example.com/workspaces/1/invitations/2/accept".to_owned(),
                organization: "Mokly & Friends".to_owned(),
                invited_by: "Alex <Admin>".to_owned(),
                valid_for: Lifetime::Days(7),
            },
        })
        .unwrap();
    let request = server.join().unwrap();
    let body = request_body(&request);
    assert_eq!(body["TemplateAlias"], "mokly-invitation");
    assert_eq!(
        body["TemplateModel"],
        json!({
            "link": "https://app.example.com/workspaces/1/invitations/2/accept",
            "organization": "Mokly & Friends",
            "invitedBy": "Alex <Admin>",
            "expiry": "7 days",
            "siteOrigin": "https://site.example.com"
        })
    );
}

#[test]
fn provider_http_and_application_failures_remain_internal() {
    for (status, body) in [
        (
            "422 Unprocessable Entity",
            include_str!("fixtures/rejected.json"),
        ),
        ("200 OK", include_str!("fixtures/rejected.json")),
        ("200 OK", "invalid-json"),
        ("500 Server Error", "{}"),
    ] {
        let (mailer, server) = recorded(status, body);
        assert!(
            mailer
                .send(&Message {
                    recipient: "receiver@example.com".to_owned(),
                    content: Content::Invitation {
                        link: "https://app.example.com/sign-in".to_owned(),
                        organization: "Team".to_owned(),
                        invited_by: "Person".to_owned(),
                        valid_for: Lifetime::Days(7),
                    }
                })
                .is_err()
        );
        server.join().unwrap();
    }
}
