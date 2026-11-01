//! Pure option normalization and environment fallbacks.

use mokly_catalogue::config_types::{ResolvedConfig, ReviewConfig};
use mokly_publish::redaction::Secret;
use mokly_publish::settings::Token;
use url::Url;

use crate::errors::Failure;
use crate::grammar::{Cli, Publish, Verb};

/// Environment values read once at the binary composition root.
#[derive(Default)]
pub struct Environment {
    /// MOKLY_SIDECARS override.
    pub sidecars: Option<String>,
    /// MOKLY_SIDECAR_TIMEOUT_MS override, parsed before command work.
    pub sidecar_timeout_ms: Option<String>,
    /// MOKLY_ENDPOINT fallback.
    pub endpoint: Option<String>,
    /// MOKLY_TOKEN fallback.
    pub token: Option<Secret>,
    /// Available core count used only for the default pool size.
    pub cores: usize,
}

/// Normalize defaults and validate environment fallbacks before command work.
pub fn validate(cli: &mut Cli, environment: &Environment) -> Result<(), Failure> {
    let serve = match &mut cli.command {
        Some(Verb::Serve(command)) => Some(&mut command.options),
        None => Some(&mut cli.serve),
        _ => None,
    };
    if let Some(serve) = serve {
        serve.watch = !serve.no_watch;
        serve.port.get_or_insert(4173);
    }
    let common = cli.common_mut();
    let sidecars = match common.sidecars {
        Some(value) => value,
        None => match environment.sidecars.as_deref() {
            Some(value) => match value.parse::<usize>() {
                Ok(value) if value > 0 => value,
                _ => return Err(Failure::SidecarEnvironment),
            },
            None => environment.cores.max(1),
        },
    };
    common.sidecars = Some(sidecars);
    common.sidecar_timeout_ms = match environment.sidecar_timeout_ms.as_deref() {
        None => None,
        Some(value) => match value.parse::<u64>() {
            Ok(value) if value > 0 => Some(value),
            _ => return Err(Failure::SidecarTimeoutEnvironment),
        },
    };
    if let Some(Verb::Publish(publish)) = &mut cli.command {
        validate_publish(publish, environment)?;
    }
    Ok(())
}

/// Apply a one-run CLI override without reading the historical configuration.
pub fn apply_base_install_scripts(config: &mut ResolvedConfig, override_value: Option<bool>) {
    if let Some(value) = override_value {
        config.input.review.get_or_insert(ReviewConfig {
            base: None,
            base_install_scripts: None,
        });
        if let Some(review) = &mut config.input.review {
            review.base_install_scripts = Some(value);
        }
    }
}

fn validate_publish(publish: &mut Publish, environment: &Environment) -> Result<(), Failure> {
    let endpoint = publish
        .endpoint
        .as_ref()
        .or(environment.endpoint.as_ref())
        .filter(|value| !value.is_empty())
        .ok_or(Failure::EndpointRequired)?;
    let valid_url = Url::parse(endpoint).is_ok_and(|url| {
        matches!(url.scheme(), "https" | "http")
            && url.host_str().is_some()
            && url.username().is_empty()
            && url.password().is_none()
            && url.fragment().is_none()
    });
    if !valid_url {
        return Err(Failure::EndpointInvalid);
    }
    let token = publish
        .token
        .as_ref()
        .or(environment.token.as_ref())
        .filter(|value| !value.is_empty())
        .ok_or(Failure::TokenRequired)?;
    if Token::new(token.clone()).is_err() {
        return Err(Failure::TokenInvalid);
    }
    publish.endpoint = Some(endpoint.clone());
    publish.token = Some(token.clone());
    Ok(())
}
