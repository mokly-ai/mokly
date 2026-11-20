//! Product mail formatting and explicit tracing-only development delivery.

use std::sync::Arc;

use mkc_email_interface::mail::{Content, Mailer, Message, Result};
use mkc_email_templates::templates::Kind;

use crate::model::{InvitationModel, SignInModel, TemplateModel};
use crate::transport::{Email, Transport};

/// Production adapter; its HTTP collaborator is injected by the composition root.
pub struct PostmarkMailer {
    /// Confirmed sender address in the Postmark account.
    pub from: String,
    /// Validated public site origin serving the logo images.
    pub site_origin: String,
    /// Provider transport with a finite timeout.
    pub transport: Arc<dyn Transport>,
}

impl Mailer for PostmarkMailer {
    fn send(&self, message: &Message) -> Result<()> {
        let (template_alias, template_model) = match &message.content {
            Content::SignIn { link, valid_for } => (
                Kind::SignIn.alias(),
                TemplateModel::SignIn(SignInModel {
                    link: link.clone(),
                    expiry: valid_for.phrase(),
                    site_origin: self.site_origin.clone(),
                }),
            ),
            Content::Invitation {
                link,
                organization,
                invited_by,
                valid_for,
            } => (
                Kind::Invitation.alias(),
                TemplateModel::Invitation(InvitationModel {
                    link: link.clone(),
                    organization: organization.clone(),
                    invited_by: invited_by.clone(),
                    expiry: valid_for.phrase(),
                    site_origin: self.site_origin.clone(),
                }),
            ),
        };
        self.transport.send(&Email {
            from: self.from.clone(),
            to: message.recipient.clone(),
            template_alias,
            template_model,
            inline_css: false,
            message_stream: "outbound".to_owned(),
            track_opens: false,
            track_links: "None".to_owned(),
        })
    }
}

/// Explicit development adapter; logs action links without an SMTP server.
pub struct LogMailer;

impl Mailer for LogMailer {
    fn send(&self, message: &Message) -> Result<()> {
        tracing::info!(target: "mkc_dev_mail", recipient = %message.recipient, link = %message.content.link(), "development email");
        Ok(())
    }
}
