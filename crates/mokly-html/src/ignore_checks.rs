//! Validate authored ignore identities after parsing has filtered wrapper attributes.

use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};
use crate::tree::Element;

pub(crate) fn filter_attributes(element: &mut Element) {
    let allowed = match element.name.as_str() {
        "mokly-ignore" => ["id", "material-key", "mokly-if", "mokly-viewport"].as_slice(),
        "mokly-ignore-scope" => ["enabled", "mokly-if", "mokly-viewport"].as_slice(),
        _ => return,
    };
    element
        .attributes
        .retain(|attribute| allowed.contains(&attribute.name.as_str()));
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
