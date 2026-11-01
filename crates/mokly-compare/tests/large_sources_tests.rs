//! Unrelated repository paths and oversized opaque resources do not prevent Changes.

use std::fs::{self, OpenOptions};
use std::io::{Seek, SeekFrom, Write};

use mokly_git::identity::ObjectId;

#[expect(
    dead_code,
    reason = "these fixtures exercise only source size and scope"
)]
mod engine_support;
use engine_support::Fixture;

#[expect(
    dead_code,
    reason = "The shared host fixtures also support cache and install tests."
)]
mod support;

#[test]
fn a_hundred_thousand_unrelated_tracked_files_are_not_indexed() {
    let mut fixture = Fixture::new(&[(
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<p>Before</p>",
    )]);
    let object = String::from_utf8(support::git_input(
        fixture.directory.path(),
        &["hash-object", "-w", "--stdin"],
        b"unrelated",
    ))
    .unwrap();
    let index: String = (0..100_001)
        .map(|i| format!("100644 {}\tunrelated/{i}\n", object.trim()))
        .collect();
    support::git_input(
        fixture.directory.path(),
        &["update-index", "--index-info"],
        index.as_bytes(),
    );
    fixture.refresh_base();
    fixture.edit(
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<p>After</p>",
    );
    let result = fixture.compare().unwrap();
    assert_eq!(result.snapshot.changed_entries, ["home"]);
}

#[test]
fn a_seventy_megabyte_video_compares_by_streamed_digest() {
    let mut fixture = Fixture::new(&[(
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<video src=\"../../movie.mp4\"></video>",
    )]);
    let path = fixture.directory.path().join("movie.mp4");
    fs::File::create(&path)
        .unwrap()
        .set_len(70 * 1024 * 1024)
        .unwrap();
    support::git(fixture.directory.path(), &["add", "movie.mp4"]);
    fixture.refresh_base();
    let stable = fixture.compare().unwrap();
    assert!(stable.snapshot.changed_entries.is_empty());
    let mut file = OpenOptions::new().write(true).open(path).unwrap();
    file.seek(SeekFrom::End(-1)).unwrap();
    file.write_all(b"x").unwrap();
    let changed = fixture.compare().unwrap();
    assert_eq!(changed.snapshot.changed_entries, ["home"]);
    assert_eq!(changed.resource_work.read_bytes, 0);
    assert_eq!(changed.resource_work.retained_bytes, 0);
}

impl Fixture {
    fn refresh_base(&mut self) {
        support::git(
            self.directory.path(),
            &[
                "-c",
                "user.name=Fixture",
                "-c",
                "user.email=fixture@example.test",
                "commit",
                "--allow-empty",
                "-m",
                "additional base inputs",
            ],
        );
        self.commit = ObjectId::parse(
            String::from_utf8(support::git(self.directory.path(), &["rev-parse", "HEAD"]))
                .unwrap()
                .trim(),
        )
        .unwrap();
    }
}
