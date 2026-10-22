//! Reference resolution and working change inventory use the validated checkout.

use std::collections::BTreeMap;

use crate::changes::{self, Change, ChangedPath, Kind};
use crate::command::DEFAULT_OUTPUT_LIMIT;
use crate::error::{Error, Result};
use crate::identity::ObjectId;
use crate::repository::GitRepository;
use crate::tree::{self, text};

impl GitRepository {
    pub(crate) fn merge_base_of(&self, base: &str) -> Result<ObjectId> {
        let reference = format!("{base}^{{commit}}");
        let resolved = self.command(
            &["rev-parse", "--verify", "--end-of-options", &reference],
            vec![],
            1024,
        )?;
        let resolved = ObjectId::parse(text(&resolved)?.trim())?;
        match self.command(&["merge-base", resolved.as_str(), "HEAD"], vec![], 1024) {
            Ok(output) => ObjectId::parse(text(&output)?.trim()),
            Err(Error::CommandFailed {
                status: Some(1), ..
            }) => Err(Error::NoMergeBase),
            Err(error) => Err(error),
        }
    }

    pub(crate) fn changes_from(&self, base: &ObjectId) -> Result<Vec<Change>> {
        let tracked = self.command(
            &[
                "diff",
                "--name-status",
                "-z",
                "--find-renames",
                "--no-ext-diff",
                "--no-textconv",
                base.as_str(),
                "--",
            ],
            vec![],
            DEFAULT_OUTPUT_LIMIT,
        )?;
        let mut changes: BTreeMap<_, _> = changes::parse(&tracked)?
            .into_iter()
            .map(|change| (change.path.clone(), change))
            .collect();
        let untracked = self.command(
            &["ls-files", "--others", "--exclude-standard", "-z"],
            vec![],
            DEFAULT_OUTPUT_LIMIT,
        )?;
        for field in changes::fields(&untracked)? {
            let Some(value) = tree::candidate(field) else {
                continue;
            };
            let path = ChangedPath::parse(value)?;
            changes
                .entry(path.clone())
                .and_modify(|change| {
                    if change.kind == Kind::Deleted {
                        change.kind = Kind::Modified;
                    }
                })
                .or_insert(Change {
                    path,
                    kind: Kind::Added,
                });
        }
        Ok(changes.into_values().collect())
    }
}
