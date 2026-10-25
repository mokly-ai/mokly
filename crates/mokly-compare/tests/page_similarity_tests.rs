//! Page similarity reads paired canonical author content, including caller slots.

#[expect(dead_code, reason = "these fixtures only replace page sources")]
mod engine_support;

use engine_support::Fixture;

fn compare_bodies(before: &str, after: &str) -> usize {
    let page = |body| {
        format!(
            "---\ntitle: Page\n---\n<!doctype html><html><head><title>Page</title></head><body>{body}</body></html>"
        )
    };
    let fixture = Fixture::new(&[
        ("specs/old.page.html", &page(before)),
        (
            "specs/card.component.html",
            "---\ntitle: Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, properties: {}}\nslots: [children]\n---\n<article><p>Shared component one</p><p>Shared component two</p><slot></slot></article>",
        ),
    ]);
    fixture.remove("specs/old.page.html");
    fixture.edit("specs/new.page.html", &page(after));
    fixture.compare().unwrap().counts.moved
}

#[test]
fn projected_component_output_and_paired_ignore_content_do_not_create_similarity() {
    assert_eq!(
        compare_bodies(
            "<ui-card></ui-card><p>Old author</p>",
            "<ui-card></ui-card><p>New author</p>",
        ),
        0
    );
    assert_eq!(
        compare_bodies(
            "<mokly-ignore id=\"chrome\"><p>Shared one</p><p>Shared two</p></mokly-ignore><p>Old author</p>",
            "<mokly-ignore id=\"chrome\"><p>Shared one</p><p>Shared two</p></mokly-ignore><p>New author</p>",
        ),
        0
    );
}

#[test]
fn caller_slots_and_one_sided_ignore_content_still_supply_author_lines() {
    assert_eq!(
        compare_bodies(
            "<ui-card><p>Shared slot</p></ui-card><p>Old author</p>",
            "<ui-card><p>Shared slot</p></ui-card><p>New author</p>",
        ),
        1
    );
    assert_eq!(
        compare_bodies(
            "<mokly-ignore id=\"chrome\"><p>Shared</p></mokly-ignore><p>Old author</p>",
            "<p>Shared</p><p>New author</p>",
        ),
        1
    );
}

#[test]
fn static_text_preserves_pre_lines_and_excludes_hidden_and_template_content() {
    assert_eq!(
        compare_bodies("<pre>One\nTwo\nBefore</pre>", "<pre>One\nTwo\nAfter</pre>",),
        1
    );
    assert_eq!(
        compare_bodies(
            "<p hidden>Shared one</p><template>Shared two</template><p aria-hidden=\"true\">Shared three</p><p>Before</p>",
            "<p hidden>Shared one</p><template>Shared two</template><p aria-hidden=\"true\">Shared three</p><p>After</p>",
        ),
        0
    );
}
