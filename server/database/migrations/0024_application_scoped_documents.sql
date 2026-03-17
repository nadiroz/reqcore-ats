-- Migration 0024: application-scoped documents
-- Adds optional applicationId to document table so documents can be
-- associated with a specific application in addition to the candidate.

ALTER TABLE "document"
  ADD COLUMN IF NOT EXISTS "application_id" text
    REFERENCES "application"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "document_application_idx"
  ON "document"("organization_id", "application_id")
  WHERE "application_id" IS NOT NULL;
