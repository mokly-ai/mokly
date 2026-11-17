//! A ready replay plans nothing and performs no storage work.

use std::io::Cursor;

use mkc_store_interface::publication::{PublicationFailure, PublicationsMock};
use mkc_store_interface::publication_event::PublicationEventsMock;
use mkc_store_interface::token::TokensMock;
use unimock::{MockFn, Unimock, matching};

use crate::ingest::Ingest;

use super::{authorization, service, validator};
use crate::tests::support::{PROJECT, PUBLICATION, bundle, publication};

#[test]
fn ready_replay_plans_an_empty_missing_set_without_storage_calls() {
    let ingest = service(
        Unimock::new((
            PublicationsMock::insert_publication
                .next_call(matching!(_))
                .returns(Ok(())),
            PublicationEventsMock::insert_publication_event
                .each_call(matching!(_))
                .answers(&|_, _| Ok(()))
                .n_times(2),
            PublicationsMock::validate_publication
                .next_call(matching!(&PUBLICATION, _))
                .returns(Ok(true)),
            PublicationsMock::publication_by_identity
                .next_call(matching!(&PROJECT, _, "mokly.config.json"))
                .returns(Ok(Some(publication()))),
            PublicationsMock::fail_publication
                .next_call(matching!(&PUBLICATION, PublicationFailure::Superseded))
                .returns(Ok(true)),
            TokensMock::save_token
                .next_call(matching!((token,) if token.last_used_at.is_some()))
                .returns(Ok(())),
        )),
        validator(bundle()),
        Unimock::new(()),
    );
    let plan = ingest
        .preflight(authorization(), &mut Cursor::new([]))
        .unwrap();
    assert!(plan.missing.is_empty());
    assert_eq!(plan.upload, PUBLICATION);
}
