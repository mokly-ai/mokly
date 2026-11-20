//! Portable token paths resolve per document without changing comments or invalid paths.

use mokly_catalogue::html_input::DeliveredHtml;

use mokly_html::{parse, serialize};

use crate::asset_tokens::rewrite;

#[test]
fn asset_tokens_rewrite_attributes_srcset_styles_and_text_at_each_document_depth() {
    let source = concat!(
        "<img src='mokly-asset:[specs/logo.png]?size=2#mark' ",
        "srcset='mokly-asset:[specs/logo.png] 1x, mokly-asset:[node_modules/@icons/icon.svg] 2x' ",
        "style='background:url(mokly-asset:[specs/logo.png]#background)' ",
        "data-src='mokly-asset:[node_modules/@icons/icon.svg]'>",
        "<p>beforemokly-asset:[specs/logo.png]after",
        "mokly-asset:[node_modules/@icons/icon.svg]",
        " mokly-asset:[unknown.png] mokly-asset:[specs/logo.png.extra]",
        " mokly-asset:[specs/not portable.png]</p>",
        "<p>mokly-asset:[node_modules/.mokly-roots//image.png]</p>",
        "<!--mokly-asset:[specs/logo.png]-->",
    );
    let original = parse::html(DeliveredHtml::fragment(source));
    for (route, prefix) in [
        ("home/index.html", "../"),
        ("nested/home/index.html", "../../"),
    ] {
        let mut nodes = original.clone();
        rewrite(&mut nodes, route);
        assert_eq!(
            serialize::html(&nodes),
            format!(
                "<img src=\"{prefix}assets/specs/logo.png?size=2#mark\" srcset=\"{prefix}assets/specs/logo.png 1x, {prefix}assets/node_modules/%40icons/icon.svg 2x\" style=\"background:url({prefix}assets/specs/logo.png#background)\" data-src=\"{prefix}assets/node_modules/%40icons/icon.svg\"><p>before{prefix}assets/specs/logo.pngafter{prefix}assets/node_modules/%40icons/icon.svg {prefix}assets/unknown.png {prefix}assets/specs/logo.png.extra mokly-asset:[specs/not portable.png]</p><p>mokly-asset:[node_modules/.mokly-roots//image.png]</p><!--mokly-asset:[specs/logo.png]-->"
            )
        );
    }
}
