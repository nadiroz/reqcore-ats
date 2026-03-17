CREATE TABLE IF NOT EXISTS "notification" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "body" text,
  "resource_type" text,
  "resource_id" text,
  "read_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "notification_user_idx"
  ON "notification"("user_id", "read_at");
CREATE INDEX IF NOT EXISTS "notification_org_user_idx"
  ON "notification"("organization_id", "user_id");
