//! Plan, bounded concurrent Blobs, Complete and one whole-command re-plan.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use async_trait::async_trait;
use bytes::Bytes;
use futures_util::{StreamExt, stream};

use crate::accounting::{Receipt, count, plan_digests, progress};
use crate::completion::{Completion, rejection};
use crate::error::{Error, Result};
use crate::http::{Http, Request, Step};
use crate::plan::Plan;
use crate::retry::Requests;
use crate::runtime::{Cancellation, Clock, Reporter};
use crate::settings::Settings;
use crate::snapshot::Prepared;

/// Upload a fully validated snapshot. No filesystem or Git work happens here.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ExchangeMock))]
#[async_trait]
pub trait Exchange: Send + Sync {
    /// Publish one frozen output and return whole-command accounting.
    async fn publish(
        &self,
        prepared: &Prepared,
        settings: &Settings,
        cancellation: &dyn Cancellation,
    ) -> Result<Receipt>;
}

/// Exchange coordinator, consumed through dyn Exchange.
pub struct Client {
    /// One-attempt HTTP boundary, without retries or redirects.
    pub http: Arc<dyn Http>,
    /// Clock, backoff waits and random jitter.
    pub clock: Arc<dyn Clock>,
    /// Safe per-round accounting observer.
    pub reporter: Arc<dyn Reporter>,
}

#[async_trait]
impl Exchange for Client {
    async fn publish(
        &self,
        prepared: &Prepared,
        settings: &Settings,
        cancellation: &dyn Cancellation,
    ) -> Result<Receipt> {
        let requests = Requests {
            http: self.http.as_ref(),
            clock: self.clock.as_ref(),
            settings,
            cancellation,
        };
        let mut uploaded = plan_digests(prepared);
        for round in 0..2 {
            let result = self.round(&requests, prepared, round, &mut uploaded).await;
            match result {
                Ok(completion) => {
                    let uploaded = count(prepared, &uploaded);
                    return Ok(Receipt {
                        completion,
                        uploaded,
                        unchanged: prepared.ownership.files.len() - uploaded,
                    });
                }
                Err(Error::Replan) if round == 0 => tracing::debug!("re-planning catalogue upload"),
                Err(Error::Replan) => return Err(Error::Failed),
                Err(error) => return Err(error),
            }
        }
        Err(Error::Failed)
    }
}

impl Client {
    async fn round(
        &self,
        requests: &Requests<'_>,
        prepared: &Prepared,
        round: usize,
        uploaded: &mut BTreeSet<String>,
    ) -> Result<Completion> {
        let request = Request {
            step: Step::Plan,
            url: requests.settings.endpoint.clone(),
            body: prepared.archive.clone(),
            timeout: Duration::from_secs(120),
        };
        let response = requests.send(&request, None, None).await?;
        if response.status != 200 {
            rejection(response.status)?;
        }
        let plan = Plan::parse(&response, requests.settings, &prepared.digests())?;
        let archive_digests = plan_digests(prepared);
        if plan
            .missing
            .iter()
            .any(|digest| archive_digests.contains(digest))
        {
            return Err(Error::Failed);
        }
        let attempted: Vec<_> = plan
            .missing
            .iter()
            .map(|_| Arc::new(AtomicBool::new(false)))
            .collect();
        let result = self
            .blobs(requests, prepared, &plan, round, &attempted)
            .await;
        uploaded.extend(
            plan.missing
                .iter()
                .zip(&attempted)
                .filter(|(_, attempted)| attempted.load(Ordering::SeqCst))
                .map(|(digest, _)| digest.clone()),
        );
        result?;
        let request = Request {
            step: Step::Complete,
            url: plan.complete_url.clone(),
            body: Bytes::new(),
            timeout: Duration::from_secs(120),
        };
        Completion::parse(
            &requests.send(&request, Some(plan.expires_at), None).await?,
            &requests.settings.token,
        )
    }

    async fn blobs(
        &self,
        requests: &Requests<'_>,
        prepared: &Prepared,
        plan: &Plan,
        round: usize,
        attempted: &[Arc<AtomicBool>],
    ) -> Result<()> {
        if plan.missing.is_empty() {
            return Ok(());
        }
        let mut counts = BTreeMap::<&str, usize>::new();
        for entry in &prepared.ownership.files {
            *counts.entry(&entry.sha256).or_default() += 1;
        }
        let mut progress = progress(prepared, &plan.missing, round);
        self.reporter.progress(&progress);
        let jobs = stream::iter(
            plan.missing
                .iter()
                .cloned()
                .zip(attempted.iter().cloned())
                .collect::<Vec<_>>(),
        )
        .map(|(digest, attempted)| async move {
            let request = Request {
                step: Step::Blob,
                url: plan.blob_target(&digest, requests.settings)?,
                body: prepared
                    .blobs
                    .get(&digest)
                    .ok_or(Error::InvalidBundle)?
                    .clone(),
                timeout: Duration::from_secs(120),
            };
            let response = requests
                .send(&request, Some(plan.expires_at), Some(attempted.as_ref()))
                .await?;
            match response.status {
                200..=299 => Ok(digest),
                410 => Err(Error::Replan),
                status => {
                    rejection(status)?;
                    Err(Error::Failed)
                }
            }
        })
        .buffer_unordered(usize::from(requests.settings.concurrency));
        tokio::pin!(jobs);
        while let Some(result) = jobs.next().await {
            let digest = result?;
            progress.completed += counts.get(digest.as_str()).copied().unwrap_or(0);
            self.reporter.progress(&progress);
        }
        Ok(())
    }
}
