-- Assessment templates (per job) and sessions (per application)
-- Also adds application_task for internal task tracking

CREATE TABLE IF NOT EXISTS "job_assessment_template" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "job_id" text NOT NULL REFERENCES "job"("id") ON DELETE CASCADE,
  "config" jsonb NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "job_assessment_template_job_idx"
  ON "job_assessment_template"("organization_id", "job_id");

CREATE TABLE IF NOT EXISTS "application_assessment" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "application_id" text NOT NULL REFERENCES "application"("id") ON DELETE CASCADE,
  "template_id" text REFERENCES "job_assessment_template"("id") ON DELETE SET NULL,
  "status" text NOT NULL DEFAULT 'not_started',
  "current_round" integer NOT NULL DEFAULT 1,
  "round1_due_date" timestamp,
  "round2_due_date" timestamp,
  "scores" jsonb,
  "behavioral_notes" text,
  "overall_score" real,
  "decision" text,
  "trainability_notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "application_assessment_app_idx"
  ON "application_assessment"("organization_id", "application_id");

CREATE TABLE IF NOT EXISTS "application_task" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "application_id" text NOT NULL REFERENCES "application"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "task_type" text NOT NULL DEFAULT 'internal',
  "due_date" timestamp,
  "completed_at" timestamp,
  "completed_by_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_by_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "app_task_app_idx"
  ON "application_task"("organization_id", "application_id");
