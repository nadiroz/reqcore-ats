CREATE TABLE IF NOT EXISTS "user_notification_preferences" (
  "user_id" text PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "preferences" jsonb NOT NULL DEFAULT '{}',
  "updated_at" timestamp NOT NULL DEFAULT now()
);
