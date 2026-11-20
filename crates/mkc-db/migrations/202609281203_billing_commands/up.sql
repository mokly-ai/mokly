ALTER TABLE billing_customers
    DROP COLUMN checkout_pending_until;

ALTER TABLE billing_subscription_items
    DROP COLUMN requested_quantity,
    DROP COLUMN requested_at,
    DROP COLUMN retry_at;

CREATE TABLE billing_checkout_sessions (
    id uuid PRIMARY KEY,
    organization_id uuid NOT NULL UNIQUE REFERENCES organizations ON DELETE CASCADE,
    provider_customer_id text NOT NULL CHECK (length(provider_customer_id) > 0),
    editor_price_id text NOT NULL CHECK (length(editor_price_id) > 0),
    editor_quantity integer NOT NULL CHECK (editor_quantity > 0),
    collaborator_price_id text NOT NULL CHECK (length(collaborator_price_id) > 0),
    collaborator_quantity integer NOT NULL CHECK (collaborator_quantity >= 0),
    trial_period_days integer CHECK (trial_period_days > 0),
    success_url text NOT NULL CHECK (length(success_url) > 0),
    cancel_url text NOT NULL CHECK (length(cancel_url) > 0),
    expires_at timestamptz NOT NULL,
    idempotency_key text NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 1 AND 255),
    provider_session_id text UNIQUE,
    provider_session_url text,
    created_at timestamptz NOT NULL,
    version bigint NOT NULL CHECK (version > 0),
    CHECK ((provider_session_id IS NULL) = (provider_session_url IS NULL)),
    CHECK (provider_session_id IS NULL OR length(provider_session_id) > 0),
    CHECK (provider_session_url IS NULL OR length(provider_session_url) > 0)
);

CREATE TABLE billing_seat_commands (
    id uuid PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
    seat_kind text NOT NULL CHECK (seat_kind IN ('editor', 'collaborator')),
    provider_subscription_id text NOT NULL CHECK (length(provider_subscription_id) > 0),
    operation text NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
    provider_item_id text,
    price_id text NOT NULL CHECK (length(price_id) > 0),
    quantity integer NOT NULL CHECK (quantity >= 0),
    idempotency_key text NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 1 AND 255),
    due_at timestamptz NOT NULL,
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    lease uuid,
    lease_until timestamptz,
    created_at timestamptz NOT NULL,
    UNIQUE (organization_id, seat_kind),
    CHECK ((lease IS NULL) = (lease_until IS NULL)),
    CHECK (
        (operation = 'create' AND provider_item_id IS NULL AND quantity > 0)
        OR (operation = 'update' AND provider_item_id IS NOT NULL AND quantity > 0)
        OR (operation = 'delete' AND provider_item_id IS NOT NULL AND quantity = 0)
    ),
    CHECK (provider_item_id IS NULL OR length(provider_item_id) > 0)
);

CREATE INDEX billing_seat_command_queue
    ON billing_seat_commands (due_at, created_at);
