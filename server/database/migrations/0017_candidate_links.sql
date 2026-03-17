-- Extend document_type enum with portfolio, reference, and certificate options
ALTER TYPE "document_type" ADD VALUE IF NOT EXISTS 'portfolio';
ALTER TYPE "document_type" ADD VALUE IF NOT EXISTS 'reference';
ALTER TYPE "document_type" ADD VALUE IF NOT EXISTS 'certificate';

-- External profile links for candidates (GitHub, LinkedIn, portfolio site, etc.)
CREATE TABLE IF NOT EXISTS "candidate_link" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "candidate_id" text NOT NULL,
  "type" text NOT NULL DEFAULT 'other',
  "url" text NOT NULL,
  "label" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "candidate_link_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
  CONSTRAINT "candidate_link_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "candidate"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "candidate_link_org_cand_idx"
  ON "candidate_link"("organization_id", "candidate_id");
