ALTER TABLE "comment" ADD COLUMN IF NOT EXISTS "parent_id" text REFERENCES "comment"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "comment_parent_idx" ON "comment"("parent_id");
