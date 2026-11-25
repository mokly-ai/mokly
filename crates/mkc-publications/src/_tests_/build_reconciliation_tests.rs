//! Inventory cleanup keeps only the currently running operation.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::Arc;

use mkc_store_interface::build::BuildsMock;
use sandbox_interface::{
    BackendManagedSandbox, OperationId, ProviderRef, SandboxId, SandboxLifecycleMock, SandboxState,
};
use unimock::{MockFn, Unimock, matching};

use crate::build_reconciliation::{BuildReconciler, SandboxBuildReconciler};
use crate::tests::build_fixtures::*;

#[tokio::test]
async fn reconciliation_destroys_unknown_terminal_replaced_and_missing_ids() {
    let inventory = (0..5)
        .map(|index| BackendManagedSandbox {
            provider_ref: ProviderRef::new(format!("sandbox-{index}")),
            state: SandboxState::Ready,
            sandbox_id: (index != 4).then(|| SandboxId::from_uuid(BUILD.0)),
            operation_id: (index != 3)
                .then(|| OperationId::from_uuid(if index == 0 { OPERATION } else { LEASE })),
            consumer: None,
            lifetime: None,
        })
        .collect();
    let lifecycle = Unimock::new((
        SandboxLifecycleMock::list_managed_sandboxes
            .some_call(matching!(_))
            .returns(Ok(inventory)),
        SandboxLifecycleMock::destroy_sandbox
            .each_call(matching!(_))
            .answers(&|_, provider| {
                assert_ne!(provider.as_str(), "sandbox-0");
                Ok(())
            })
            .n_times(4),
    ));
    let queries = Unimock::new(
        BuildsMock::build_operation
            .each_call(matching!(_))
            .answers(&|_, _| Ok(Some(OPERATION))),
    );
    let reconciler: &dyn BuildReconciler = &SandboxBuildReconciler {
        lifecycle: Arc::new(lifecycle),
        transactions: transactions(queries),
        deployment_id: "builds-test".into(),
    };
    assert_eq!(reconciler.reconcile().await.unwrap(), 4);
}
