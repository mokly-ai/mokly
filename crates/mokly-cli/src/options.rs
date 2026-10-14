//! Pure option normalization and command restrictions.

use url::Url;

use crate::errors::Failure;
use crate::grammar::{Cli, Publish, Verb};

/// Environment values read once at the binary composition root.
#[derive(Default)]
pub struct Environment {
    /// MOKLY_SIDECARS override.
    pub sidecars: Option<String>,
    /// MOKLY_ENDPOINT fallback.
    pub endpoint: Option<String>,
    /// MOKLY_TOKEN fallback.
    pub token: Option<String>,
    /// Available core count.
    pub cores: usize,
}

/// Validate environment fallbacks before any command subsystem starts.
pub fn validate(cli: &mut Cli, environment: &Environment) -> std::result::Result<(), Failure> {
    if !matches!(cli.command, None | Some(Verb::Serve(_)))
        && (cli.serve.port.is_some() || cli.serve.watch || cli.serve.no_watch || cli.serve.open)
    {
        return Err(Failure::Invalid {
            message: "Serve options belong to serve".into(),
        });
    }
    if let Some(Verb::Serve(serve)) = &mut cli.command {
        if serve.port.is_some() && cli.serve.port.is_some() {
            return Err(Failure::Invalid {
                message: "--port cannot be supplied twice".into(),
            });
        }
        serve.port = serve.port.or(cli.serve.port);
        serve.watch |= cli.serve.watch;
        serve.no_watch |= cli.serve.no_watch;
        serve.open |= cli.serve.open;
        if serve.watch && serve.no_watch {
            return Err(Failure::Invalid {
                message: "--watch conflicts with --no-watch".into(),
            });
        }
        serve.watch = !serve.no_watch;
        serve.port.get_or_insert(4173);
    } else if cli.command.is_none() {
        cli.serve.watch = !cli.serve.no_watch;
        cli.serve.port.get_or_insert(4173);
    }
    let cores = environment.cores.max(1);
    let sidecars = match cli.common.sidecars {
        Some(value) => value,
        None => match environment.sidecars.as_deref() {
            Some(value) => match value.parse::<usize>() {
                Ok(value) if value > 0 => value,
                _ => {
                    return Err(Failure::Invalid {
                        message: "MOKLY_SIDECARS must be a positive integer".into(),
                    });
                }
            },
            None => cores,
        },
    };
    if sidecars > cores {
        return Err(Failure::Invalid {
            message: format!("--sidecars must be between 1 and {cores}"),
        });
    }
    cli.common.sidecars = Some(sidecars);
    if let Some(Verb::Publish(publish)) = &mut cli.command {
        validate_publish(publish, environment)?;
    }
    Ok(())
}

fn validate_publish(
    publish: &mut Publish,
    environment: &Environment,
) -> std::result::Result<(), Failure> {
    let invalid = |message: &str| Failure::Invalid {
        message: message.to_owned(),
    };
    let endpoint = publish
        .endpoint
        .as_ref()
        .or(environment.endpoint.as_ref())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| invalid("publish requires --endpoint or MOKLY_ENDPOINT"))?;
    let valid_url = Url::parse(endpoint).is_ok_and(|url| {
        matches!(url.scheme(), "https" | "http")
            && url.host_str().is_some()
            && url.username().is_empty()
            && url.password().is_none()
            && url.fragment().is_none()
    });
    if !valid_url {
        return Err(invalid(
            "publish endpoint must be an HTTP(S) URL without credentials or a fragment",
        ));
    }
    let token = publish
        .token
        .as_ref()
        .or(environment.token.as_ref())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| invalid("publish requires --token or MOKLY_TOKEN"))?;
    let core = token.trim_end_matches('=');
    if core.is_empty()
        || !core
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"._~+/-".contains(&byte))
    {
        return Err(invalid("publish token must use the bearer-token grammar"));
    }
    publish.endpoint = Some(endpoint.clone());
    publish.token = Some(token.clone());
    Ok(())
}
