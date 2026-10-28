//! Blocking graph admission, per-page replacement, cancellation, and draining.

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, Weak};
use std::time::Duration;

use async_trait::async_trait;
use mokly_catalogue::diagnostic::Warning;
use mokly_model::data::Props;
use tokio::sync::Semaphore;

use crate::assets::File;
use crate::backend::{Documents, PreviewDocument};
use crate::diagnostics::Diagnostics;
use crate::error::{InternalError, Result, ServerError};
use crate::foreground::Foreground;
use crate::priority::Priority;
use crate::public_read::OpenedFile;
use crate::render_request::Rejection;
use crate::revision::RenderLease;
use crate::work_page::Page;

/// Bound native HTTP and render scheduling to available machine parallelism.
pub fn parallelism(available: usize) -> u32 {
    available.clamp(1, 8) as u32
}
/// Injectable HTTP worker scheduler.
#[cfg_attr(test, unimock::unimock(api = WorkMock))]
#[async_trait]
pub trait Work: Send + Sync {
    /// Render one background document only when foreground admission is idle, and
    /// return its warnings unreported.
    async fn background(
        &self,
        documents: Arc<dyn Documents>,
        route: String,
    ) -> Result<Vec<Warning>>;
    /// Resolve a generated document off the HTTP event loop.
    async fn generated(&self, documents: Arc<dyn Documents>, route: String)
    -> Result<Option<File>>;
    /// Verify and spool a generated opaque asset off the HTTP event loop.
    async fn asset(
        &self,
        documents: Arc<dyn Documents>,
        route: String,
    ) -> Result<Option<OpenedFile>>;
    /// Recheck and read a reached public asset off the HTTP event loop.
    async fn authored(&self, documents: Arc<dyn Documents>, path: String) -> Option<OpenedFile>;
    /// Coalesce a page's work and bound admission and duration.
    /// The render runs on a blocking thread, outside the HTTP event loop, behind eight
    /// server-wide queue tickets, and fails after ten seconds.
    async fn preview(
        &self,
        documents: Arc<dyn Documents>,
        page: String,
        route: String,
        props: Props,
        lease: Arc<dyn RenderLease>,
    ) -> std::result::Result<PreviewDocument, Rejection>;
    /// Stop admission and wait for active blocking graph calls.
    async fn stop(&self);
}

/// One bounded scheduler shared by foreground jobs and background generations.
pub struct Workers {
    pub(crate) priority: Arc<Priority>,
    diagnostics: Arc<dyn Diagnostics>,
    pub(crate) workers: Arc<Semaphore>,
    /// One fair permit: queued background renders wait for admission one at a time, in
    /// request order, so a worker freed between two polls cannot reorder them.
    pub(crate) turn: Semaphore,
    /// Eight preview queue tickets server-wide. A page reuses its live ticket, so its
    /// superseded jobs never hold more than one.
    queued: Arc<Semaphore>,
    pages: Mutex<BTreeMap<String, Weak<Page>>>,
    pub(crate) closed: AtomicBool,
    parallelism: u32,
}

impl Workers {
    /// Share whole-request priority with the command's sidecar admission.
    pub fn with_foreground(mut self, shared: Arc<dyn Foreground>) -> Self {
        self.priority = Arc::new(Priority::new(shared));
        self
    }

    /// Create a bounded scheduler without starting threads or jobs.
    pub fn new(parallelism: u32, diagnostics: Arc<dyn Diagnostics>) -> Self {
        let parallelism = parallelism.max(1);
        Self {
            priority: Arc::new(Priority::default()),
            diagnostics,
            parallelism,
            workers: Arc::new(Semaphore::new(parallelism as usize)),
            turn: Semaphore::new(1),
            queued: Arc::new(Semaphore::new(8)),
            pages: Mutex::new(BTreeMap::new()),
            closed: AtomicBool::new(false),
        }
    }
}

#[async_trait]
impl Work for Workers {
    async fn background(
        &self,
        documents: Arc<dyn Documents>,
        route: String,
    ) -> Result<Vec<Warning>> {
        self.background_render(documents, route).await
    }
    async fn generated(
        &self,
        documents: Arc<dyn Documents>,
        route: String,
    ) -> Result<Option<File>> {
        self.generated_delivery(documents, route).await
    }
    async fn asset(
        &self,
        documents: Arc<dyn Documents>,
        route: String,
    ) -> Result<Option<OpenedFile>> {
        self.asset_delivery(documents, route).await
    }
    async fn authored(&self, documents: Arc<dyn Documents>, path: String) -> Option<OpenedFile> {
        let guard = self.priority.enter(true);
        if self.closed.load(Ordering::SeqCst) {
            return None;
        }
        let permit = self.workers.clone().acquire_owned().await.ok()?;
        if self.closed.load(Ordering::SeqCst) {
            return None;
        }
        tokio::task::spawn_blocking(move || {
            let _guard = guard;
            let _permit = permit;
            let documents = documents;
            documents.authored(&path)
        })
        .await
        .ok()
        .flatten()
    }
    async fn preview(
        &self,
        documents: Arc<dyn Documents>,
        page_id: String,
        route: String,
        props: Props,
        lease: Arc<dyn RenderLease>,
    ) -> std::result::Result<PreviewDocument, Rejection> {
        if !lease.valid() {
            return Err(Rejection::StaleRevision);
        }
        if self.closed.load(Ordering::SeqCst) {
            return Err(Rejection::Capacity);
        }
        let page = {
            let mut pages = self.pages.lock().unwrap_or_else(|error| error.into_inner());
            pages.retain(|_, page| page.strong_count() > 0);
            if let Some(page) = pages.get(&page_id).and_then(Weak::upgrade) {
                page
            } else {
                let page = Arc::new(Page::default());
                pages.insert(page_id, Arc::downgrade(&page));
                page
            }
        };
        let sequence = page.next.fetch_add(1, Ordering::SeqCst) + 1;
        page.changed.notify_waiters();
        let notified = page.changed.notified();
        tokio::pin!(notified);
        notified.as_mut().enable();
        let job = async {
            let guard = self.priority.enter(true);
            let (page_permit, permit) = {
                let _queued = {
                    let mut pending = page
                        .queued
                        .lock()
                        .unwrap_or_else(|error| error.into_inner());
                    if let Some(ticket) = pending.upgrade() {
                        ticket
                    } else {
                        let ticket = match self.queued.clone().try_acquire_owned() {
                            Ok(ticket) => Arc::new(ticket),
                            Err(_) => return Err(Rejection::Capacity),
                        };
                        *pending = Arc::downgrade(&ticket);
                        ticket
                    }
                };
                let page_permit = match page.gate.clone().acquire_owned().await {
                    Ok(permit) => permit,
                    Err(_) => return Err(Rejection::Capacity),
                };
                let permit = match self.workers.clone().acquire_owned().await {
                    Ok(permit) => permit,
                    Err(_) => return Err(Rejection::Capacity),
                };
                (page_permit, permit)
            };
            if self.closed.load(Ordering::SeqCst)
                || !lease.valid()
                || page.next.load(Ordering::SeqCst) != sequence
            {
                return Err(Rejection::StaleRevision);
            }
            let page_guard = page.clone();
            let parent = tracing::Span::current();
            let output = tokio::task::spawn_blocking(move || {
                parent.in_scope(|| {
                    let _guard = guard;
                    let _page = page_guard;
                    let _permit = permit;
                    let _page_permit = page_permit;
                    let documents = documents;
                    documents.preview(&route, &props)
                })
            })
            .await;
            match output {
                Ok(Ok(result)) => Ok(result),
                Ok(Err(ServerError::PreviewCapacity)) => Err(Rejection::Capacity),
                Ok(Err(error)) => {
                    self.diagnostics.failed(&error);
                    Err(Rejection::RenderFailed)
                }
                Err(error) => {
                    self.diagnostics
                        .failed(&ServerError::Internal(InternalError::Task {
                            source: error,
                        }));
                    Err(Rejection::RenderFailed)
                }
            }
        };
        tokio::select! {
            result = tokio::time::timeout(Duration::from_secs(10), job) => match result {
                Ok(result) => result,
                Err(_) => { self.diagnostics.failed(&ServerError::Deadline); Err(Rejection::RenderFailed) },
            },
            _ = &mut notified => Err(Rejection::StaleRevision),
        }
    }
    async fn stop(&self) {
        self.closed.store(true, Ordering::SeqCst);
        self.priority.changed.notify_waiters();
        let _permits = self
            .workers
            .clone()
            .acquire_many_owned(self.parallelism)
            .await;
        self.pages
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clear();
    }
}

#[cfg(test)]
#[path = "_tests_/work/mod.rs"]
mod work_tests;
