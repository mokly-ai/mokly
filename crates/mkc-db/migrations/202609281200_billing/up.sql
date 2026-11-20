ALTER TABLE organizations DROP CONSTRAINT organizations_plan_check;
ALTER TABLE organizations
    ADD CONSTRAINT organizations_plan_check CHECK (plan IN ('free', 'team'));

CREATE TABLE billing_customers (
    organization_id uuid PRIMARY KEY REFERENCES organizations ON DELETE CASCADE,
    provider_customer_id text NOT NULL UNIQUE CHECK (length(provider_customer_id) > 0),
    trial_used_at timestamptz,
    created_at timestamptz NOT NULL,
    version bigint NOT NULL CHECK (version > 0)
);

CREATE TABLE billing_subscriptions (
    organization_id uuid PRIMARY KEY REFERENCES organizations ON DELETE CASCADE,
    provider_subscription_id text NOT NULL UNIQUE CHECK (length(provider_subscription_id) > 0),
    status text NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused')),
    current_period_end timestamptz,
    trial_end timestamptz,
    cancel_at_period_end boolean NOT NULL DEFAULT false,
    payment_failed_at timestamptz,
    updated_at timestamptz NOT NULL,
    version bigint NOT NULL CHECK (version > 0)
);

CREATE TABLE billing_subscription_items (
    id uuid PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES billing_subscriptions(organization_id) ON DELETE CASCADE,
    seat_kind text NOT NULL CHECK (seat_kind IN ('editor', 'collaborator')),
    provider_item_id text NOT NULL UNIQUE,
    price_id text NOT NULL,
    quantity integer NOT NULL CHECK (quantity >= 0),
    requested_quantity integer CHECK (requested_quantity >= 0),
    requested_at timestamptz,
    UNIQUE (organization_id, seat_kind)
);

CREATE TABLE billing_deliveries (
    id text PRIMARY KEY CHECK (id ~ '^evt_[A-Za-z0-9]{1,64}$'),
    event text NOT NULL CHECK (event ~ '^[a-z_.]{1,64}$'),
    body bytea NOT NULL CHECK (octet_length(body) <= 2097152),
    received_at timestamptz NOT NULL,
    due_at timestamptz NOT NULL,
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    status text NOT NULL CHECK (status IN ('pending', 'processing', 'done', 'ignored', 'failed')),
    lease uuid,
    lease_until timestamptz,
    last_failure text CHECK (last_failure IN ('malformed', 'unavailable', 'rate-limited', 'internal')),
    CHECK ((status = 'processing') = (lease IS NOT NULL AND lease_until IS NOT NULL))
);
CREATE INDEX billing_delivery_queue ON billing_deliveries (due_at, received_at)
    WHERE status IN ('pending', 'processing');
