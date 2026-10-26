//! Filter ignore-wrapper attributes before composition evaluates them, and validate ignore ids.

use mokly_catalogue::html_tokens::reserved_navigation_attribute;
use mokly_catalogue::template_types::ignore_attribute_allowed;

use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};
use crate::tree::Element;

/// Keep the wrapper attributes that the authored parse keeps: the catalogue rule and the
/// reserved navigation names. Other elements keep all attributes.
pub(crate) fn filter_attributes(element: &mut Element) {
    let Element {
        name, attributes, ..
    } = element;
    attributes.retain(|attribute| {
        ignore_attribute_allowed(name, &attribute.name)
            || reserved_navigation_attribute(attribute.name.as_bytes())
    });
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
