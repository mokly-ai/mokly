//! Typed substitution values for Postmark's hosted email templates.

use serde::Serialize;

/// Values shared by the sign-in template's subject and bodies.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignInModel {
    /// Complete one-time callback URL.
    pub link: String,
    /// Human-readable validity interval.
    pub expiry: String,
    /// Public site origin hosting the brand images.
    pub site_origin: String,
}

/// Values shared by the invitation template's subject and bodies.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvitationModel {
    /// Complete invitation acceptance URL.
    pub link: String,
    /// Name of the organization receiving the invited person.
    pub organization: String,
    /// Stored display name of the inviting person.
    pub invited_by: String,
    /// Human-readable validity interval.
    pub expiry: String,
    /// Public site origin hosting the brand images.
    pub site_origin: String,
}

/// Exactly one of the two hosted template models.
#[derive(Serialize)]
#[serde(untagged)]
pub enum TemplateModel {
    /// Sign-in fields.
    SignIn(SignInModel),
    /// Invitation fields.
    Invitation(InvitationModel),
}
