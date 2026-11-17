//! Real shared Markdown checks reject missing files and invalid heading anchors.

use std::process::Output;

use super::support::{Fixture, FixtureFactory, TemporaryFixtures, failure, success};

fn prepare(fixture: &dyn Fixture) {
    fixture.tools();
    fixture.copy("tests/markdown_links.test.ts");
    fixture.write("package.json", r#"{"type":"module"}"#);
    fixture.write("tests/helpers/fixture.ts", "import { fileURLToPath } from 'node:url';\nexport const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));\n");
    fixture.write("docs/protocol/target.md", "# Target\n");
    for number in 0..101 {
        fixture.write(
            &format!("docs/coverage-{number}.md"),
            "[target](protocol/target.md)\n",
        );
    }
    fixture.write(
        "plans/coverage.md",
        "[target](../docs/protocol/target.md)\n",
    );
}

fn check(fixture: &dyn Fixture) -> Output {
    fixture.run(
        "node",
        &["--import", "tsx", "--test", "tests/markdown_links.test.ts"],
    )
}

#[test]
fn markdown_accepts_local_files_and_rejects_missing_destinations() {
    let fixture = TemporaryFixtures.create();
    prepare(fixture.as_ref());
    fixture.write("docs/read me.md", "# Title\n\n[root](../README.md)\n");
    fixture.write(
        "README.md",
        "# Fixture\n\n[read](docs/read%20me.md#title)\n",
    );
    success(check(fixture.as_ref()));
    fixture.write("README.md", "[gone](missing.md)\n");
    failure(check(fixture.as_ref()), "missing.md: missing file");
}

#[test]
fn markdown_accepts_heading_anchors_and_rejects_missing_headings() {
    let fixture = TemporaryFixtures.create();
    prepare(fixture.as_ref());
    fixture.write("docs/guide.md", "# Guide\n\n## Install `cli` **now**\n\n## Install `cli` **now**\n\n[top](#guide) [repeat](#install-cli-now-1)\n\n```md\n# Fenced\n```\n");
    fixture.write("src.rs", "");
    fixture.write("README.md", "# Fixture\n\n[install](docs/guide.md#install-cli-now)\n[repeat](docs/guide.md#install-cli-now-1)\n[line](src.rs#L1) [web](https://example.com/#nothing)\n");
    success(check(fixture.as_ref()));
    fixture.write("README.md", "# Fixture\n\n[fenced](docs/guide.md#fenced)\n");
    failure(
        check(fixture.as_ref()),
        "docs/guide.md#fenced: missing anchor",
    );
    fixture.write("README.md", "# Fixture\n");
    fixture.write("docs/guide.md", "# Guide\n\n[gone](#missing)\n");
    failure(check(fixture.as_ref()), "#missing: missing anchor");
}
