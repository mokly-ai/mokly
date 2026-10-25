//! Child references from an authored HTML or CSS resource.

use mokly_css::{paths, syntax};
use mokly_html::parse;

use crate::error::{Result, invalid};
use crate::references::collect;

pub(crate) fn urls(path: &str, bytes: &[u8]) -> Result<Vec<String>> {
    if path.ends_with(".css") {
        let text = String::from_utf8_lossy(bytes);
        let mut urls = Vec::new();
        for reference in syntax::references(&text) {
            if reference.image_set_string && !paths::external(&reference.value) {
                return Err(invalid(
                    path,
                    format!(
                        "image-set() string URL is unsupported in {path}: {}; wrap the URL in url() so Mokly can validate and deliver the asset",
                        reference.value
                    ),
                ));
            }
            urls.push(reference.value);
        }
        Ok(urls)
    } else if path.ends_with(".html") || path.ends_with(".htm") {
        Ok(
            collect(&parse::delivered_document(&String::from_utf8_lossy(bytes)))
                .into_iter()
                .map(|reference| reference.url)
                .collect(),
        )
    } else {
        Ok(Vec::new())
    }
}
