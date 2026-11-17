# Publication Blob Durability

This document defines how [publication ingest](./publication-ingest.md)
proves that every byte of a publication is stored before it becomes ready.
Plans store their own artifacts through the same bounded writer as blob
requests, and each blob request stores one verified body.

## Durability Marker

Each project-owned blob row carries a durability marker: the first server time
at which its current incarnation was confirmed stored. Reservation creates or
locks the project's row before any external put, so row existence alone never
proves that bytes exist. Only a verified write sets the marker, and a
publication
[becomes ready](./publication-ingest.md#state-and-atomic-visibility) only when
every blob it references carries one. A confirmation is idempotent and targets
the exact incarnation;
[Persistence boundaries](./persistence-boundaries.md#publication-storage)
states its outcomes for a confirmed, absent, reincarnated or deleting row.

A marked row lets reservation skip storage without consulting the object.
Decision: a runtime check that the object still exists was rejected, because
every stable environment removes objects only through the reference-aware
collector and each PR environment deletes its database and object prefix
together, so a marker cannot outlive the object it confirms.

Decision: completion trusts the durability markers of the files the attempt
reserved; a per-upload record of successful blob PUTs was rejected, because
the project-owned file references already prove both the right to use the
bytes and their durable storage.

## Reservation And Parallel Writes

The pending set contains one representative file per distinct hash, even when
several paths contain identical bytes; every path still has its own index row
and MIME type. Deduplication never crosses the project boundary. A null marker
is always pending, including when another in-flight upload in the same project
created the row first. Decision: the second upload writes too rather than
waiting for the first, because immutable, conditional puts make both racers
safe and a crashed reserver cannot leave a permanent hole. Reservation follows
the
[canonical blob lock order](./persistence-boundaries.md#canonical-blob-lock-order).

The writer stores the pending set with a bounded number of parallel workers.
`MKC_INGEST_WORKERS` defaults to 8; integer values are clamped to 1–32 and a
non-integer prevents API startup. Each put checks the attempt deadline
immediately before it starts and runs under the
[operation deadline](./publication-ingest.md#http-boundary). An upload uses at
most one database connection at a time for its durability markers, whatever
the worker count. The first put, deadline or marker failure stops the writer
from starting new puts; puts already in flight finish and are confirmed, and
the writer reports the first error without losing the count of successful
writes. A deadline crossed during a put does not erase durable work; the ready
transaction still rejects the expired attempt.

## Conditional Storage Writes

Every adapter verifies the bytes against the hash before a put. A put of an
object that already exists succeeds only when the provider reports a size equal
to the verified local length; a missing object, malformed metadata or a
different size is an internal failure. Decision: an existing object is
confirmed by its size and never downloaded again, because its name embeds the
verified hash, so a download adds no integrity proof. Every provider request
of one put, including credential acquisition and the existence confirmation,
shares that put's operation deadline; an exhausted budget sends no further
request.

## Trace Events

Each plan emits one `publication upload planned` event with
`publication_id`, `files`, `distinct_hashes`, `missing`, `written`, `bytes`
and `write_duration_ms`. `files` counts indexed paths; `distinct_hashes`,
`missing` and `written` count distinct hashes, `written` covering the plan's
own artifacts, and `bytes` counts successful storage-write bytes. Each stored
blob emits `publication blob stored` with its `hash`, `written`, `bytes` and
`write_duration_ms`. Counts include successful writes made before a later
failure. Logs never include file bytes, bearer credentials or user-authored
paths.
