//! The email-template stage rejects stale committed output through its CLI.

use super::support::{FixtureFactory, TemporaryFixtures, failure, success};

#[test]
fn email_template_stage_has_a_real_stale_artifact_fixture() {
    let factory: &dyn FixtureFactory = &TemporaryFixtures;
    let fixture = factory.create();
    fixture.write(
        "package.json",
        r#"{"private":true,"scripts":{"emails:build":"node scripts/emails.mjs","emails:check":"node scripts/emails.mjs --check","emails:test":"node --test scripts/emails.test.mjs"}}"#,
    );
    fixture.write(
        "scripts/emails.test.mjs",
        "import { test } from 'node:test';\ntest('fixture', () => {});\n",
    );
    fixture.write(
        "scripts/emails.mjs",
        "import fs from 'node:fs';\nconst file = 'templates/sign-in.html';\nconst expected = '<p>{{link}}</p>\\n';\nif (process.argv.includes('--check')) { if (fs.readFileSync(file, 'utf8') !== expected) throw Error('stale email template'); } else { fs.mkdirSync('templates', {recursive:true}); fs.writeFileSync(file, expected); }\n",
    );
    success(fixture.run("npm", &["run", "emails:build"]));
    success(fixture.run("npm", &["run", "emails:check"]));
    fixture.write("templates/sign-in.html", "older template\n");
    failure(
        fixture.run("npm", &["run", "emails:check"]),
        "stale email template",
    );
    success(fixture.run("npm", &["run", "emails:build"]));
    success(fixture.run("npm", &["run", "emails:check"]));
}
