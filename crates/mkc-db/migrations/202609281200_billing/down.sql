DROP TABLE billing_subscription_items;
DROP TABLE billing_subscriptions;
DROP TABLE billing_customers;
DROP TABLE billing_deliveries;

UPDATE organizations SET plan = 'free' WHERE plan <> 'free';
ALTER TABLE organizations DROP CONSTRAINT organizations_plan_check;
ALTER TABLE organizations
    ADD CONSTRAINT organizations_plan_check CHECK (plan = 'free');
