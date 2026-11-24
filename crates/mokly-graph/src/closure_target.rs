//! Exact read receipts accompany policy decisions and parsed reference edges.

use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_model::material::digest;
use mokly_source_interface::error::SourceError;

use crate::closure::{Closure, Walker};
use crate::closure_prefetch;
use crate::error::{GraphError, Result, invalid};
use crate::head_validation::{
    ValidationRead, ValidationRecorder, public_identity, resource_identity,
};
use crate::public_denial::PublicDenial;

pub(crate) fn read(
    walker: &Walker,
    route: &str,
    target: &str,
    reference: &str,
    recorder: &dyn ValidationRecorder,
    result: &mut Closure,
) -> Result<Option<Vec<String>>> {
    let (kind, bytes) = if let Some(generated) = target.strip_prefix("static/mokly-generated/") {
        if let Some(urls) = walker.index.get_identified(target) {
            recorder.content(ValidationRead::GeneratedContent, target, urls.identity);
            return Ok(Some(urls.urls));
        }
        if generated.starts_with("assets/") {
            if !walker.generated.contains_resource(generated)? {
                return Err(missing(route, reference));
            }
            return Ok(Some(Vec::new()));
        }
        (
            ValidationRead::GeneratedContent,
            walker
                .generated
                .resource(generated)?
                .ok_or_else(|| missing(route, reference))?,
        )
    } else {
        let path = target
            .strip_prefix("static/")
            .ok_or_else(|| missing(route, reference))?;
        let decision = walker.policy.check(path);
        recorder.content(
            ValidationRead::PublicTarget,
            target,
            public_identity(&decision),
        );
        let file = match decision {
            Ok(file) => file,
            Err(PublicDenial::Missing) => return Err(missing(route, reference)),
            Err(reason) => {
                return Err(invalid(
                    route,
                    format!(
                        "document links and resources are invalid:\n- {route}: protected target {reference}: {}",
                        reason.reason()
                    ),
                ));
            }
        };
        result.files.insert(path.into());
        if let Some(urls) = walker.index.get_identified(target) {
            recorder.content(ValidationRead::StaticContent, target, urls.identity);
            return Ok(Some(urls.urls));
        }
        if !target.ends_with(".css") && !target.ends_with(".html") && !target.ends_with(".htm") {
            let value = match walker.tree.digest(&file.absolute) {
                Ok(value) => value,
                Err(SourceError::Unavailable { message, .. }) => {
                    recorder.content(ValidationRead::StaticContent, target, None);
                    unavailable(result, path, target, message);
                    return Ok(None);
                }
                Err(_) => return Err(missing(route, reference)),
            };
            let identity = resource_identity(Some(&value));
            let edges = walker.index.parse_identified(target, &[], identity)?;
            recorder.content(ValidationRead::StaticContent, target, edges.identity);
            return Ok(Some(edges.urls));
        }
        let bytes = match walker.tree.read_public(&file.absolute) {
            Ok(bytes) => bytes,
            Err(SourceError::Unavailable { message, .. }) => {
                recorder.content(ValidationRead::StaticContent, target, None);
                unavailable(result, path, target, message);
                return Ok(None);
            }
            Err(_) => return Err(missing(route, reference)),
        };
        (ValidationRead::StaticContent, bytes)
    };
    let identity = resource_identity(Some(&digest(&bytes)));
    let edges = walker.index.parse_identified(target, &bytes, identity)?;
    recorder.content(kind, target, edges.identity);
    closure_prefetch::urls(walker, target, &edges.urls)?;
    Ok(Some(edges.urls))
}

fn unavailable(result: &mut Closure, path: &str, target: &str, message: String) {
    result.files.remove(path);
    result.warnings.push(Warning {
        code: "base-conversion",
        subject: WarningSubject::Route(target.into()),
        message,
    });
}

fn missing(route: &str, reference: &str) -> GraphError {
    invalid(
        route,
        format!("document links and resources are invalid:\n- {route}: missing target {reference}"),
    )
}

#[cfg(test)]
#[path = "_tests_/validation_receipt_tests.rs"]
mod validation_receipt_tests;
