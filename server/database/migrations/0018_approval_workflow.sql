-- Stage approval requests for gated pipeline transitions
CREATE TABLE IF NOT EXISTS "stage_approval_request" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "application_id" text NOT NULL,
  "from_stage" text NOT NULL,
  "to_stage" text NOT NULL,
  "requested_by_id" text NOT NULL,
  "assigned_to_id" text,
  "status" text NOT NULL DEFAULT 'pending',
  "note" text,
  "resolver_note" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "resolved_at" timestamp,
  CONSTRAINT "stage_approval_request_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
  CONSTRAINT "stage_approval_request_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE CASCADE,
  CONSTRAINT "stage_approval_request_requested_by_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "user"("id") ON DELETE CASCADE,
  CONSTRAINT "stage_approval_request_assigned_to_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "user"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "approval_request_app_idx"
  ON "stage_approval_request"("organization_id", "application_id", "status");
CREATE INDEX IF NOT EXISTS "approval_request_assignee_idx"
  ON "stage_approval_request"("assigned_to_id", "status");
