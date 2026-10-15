//! Validate authored ignore wrappers before consuming their attributes.

use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};
use crate::tree::Element;

pub(crate) fn attributes(element: &Element) -> Result<()> {
    let allowed: &[&str] = match element.name.as_str() {
        "mokly-ignore" => &["id", "material-key", "mokly-if", "mokly-viewport"],
        "mokly-ignore-scope" => &["enabled", "mokly-if", "mokly-viewport"],
        _ => return Ok(()),
    };
    if let Some(attribute) = element
        .attributes
        .iter()
        .find(|attribute| !allowed.contains(&attribute.name.as_str()))
    {
        return Err(invalid(
            Code::HtmlElement,
            format!("unknown attribute {} on <{}>", attribute.name, element.name),
        ));
    }
    Ok(())
}

pub(crate) fn id(value: &str) -> Result<()> {
    if value.is_empty()
        || value.split('-').any(|part| {
            part.is_empty()
                || !part
                    .bytes()
                    .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
        })
    {
        return Err(invalid(
            Code::HtmlElement,
            format!("invalid ignore id {value:?}; use lowercase kebab-case"),
        ));
    }
    Ok(())
}
