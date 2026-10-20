//! Validate authored ignore wrappers before consuming their attributes.

use mokly_catalogue::template_types::ignore_attribute_allowed;

use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};
use crate::tree::Element;

pub(crate) fn attributes(element: &mut Element) {
    element
        .attributes
        .retain(|attribute| ignore_attribute_allowed(&element.name, &attribute.name));
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
