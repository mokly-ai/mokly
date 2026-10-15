//! GFM bare URI and email literals outside code and explicit links.

use linkify::{LinkFinder, LinkKind};
use pulldown_cmark::{CowStr, Event, LinkType, Tag, TagEnd};

pub(crate) fn events(text: &str) -> Vec<Event<'static>> {
    let mut finder = LinkFinder::new();
    finder.url_must_have_scheme(false);
    finder.email_domain_must_have_dot(true);
    let mut output = Vec::new();
    let mut offset = 0;
    for link in finder.links(text) {
        let label = link.as_str();
        let destination = match link.kind() {
            LinkKind::Email => format!("mailto:{label}"),
            LinkKind::Url if label.starts_with("www.") => format!("http://{label}"),
            LinkKind::Url if label.starts_with("http://") || label.starts_with("https://") => {
                label.into()
            }
            _ => continue,
        };
        output.push(Event::Text(CowStr::from(
            text[offset..link.start()].to_owned(),
        )));
        output.push(Event::Start(Tag::Link {
            link_type: LinkType::Autolink,
            dest_url: CowStr::from(destination),
            title: CowStr::from(""),
            id: CowStr::from(""),
        }));
        output.push(Event::Text(CowStr::from(label.to_owned())));
        output.push(Event::End(TagEnd::Link));
        offset = link.end();
    }
    output.push(Event::Text(CowStr::from(text[offset..].to_owned())));
    output
}
