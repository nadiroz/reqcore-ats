-- Convert application.status from enum to plain text so custom stage IDs can be stored
-- Must drop the enum default before altering the column type, then re-add as plain text default
ALTER TABLE "application" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "application" ALTER COLUMN "status" TYPE text;
ALTER TABLE "application" ALTER COLUMN "status" SET DEFAULT 'new';
DROP TYPE IF EXISTS "application_status";

-- Per-org pipeline configuration (labels, custom stages)
CREATE TABLE IF NOT EXISTS "org_settings" (
  "organization_id" text PRIMARY KEY NOT NULL,
  "pipeline_config" jsonb,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "org_settings_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE
);
