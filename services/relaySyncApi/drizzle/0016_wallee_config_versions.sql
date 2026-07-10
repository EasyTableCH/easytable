ALTER TABLE "wallee_payment_profiles" ADD COLUMN IF NOT EXISTS "config_version" integer DEFAULT 1 NOT NULL;
