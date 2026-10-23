-- What people ask the assistant and whether it could answer: used to suggest questions that work and to show administrators the gaps.
-- Customers' questions are stored as structured facts only (intent, service, city, number of results); free text is kept only for staff questions the assistant could not answer.
CREATE TABLE IF NOT EXISTS "LumaQuestionLog" (
  "id" TEXT PRIMARY KEY,
  "audience" TEXT NOT NULL,
  "intent" TEXT NOT NULL,
  "categoryId" TEXT,
  "cityId" TEXT,
  "resultCount" INTEGER NOT NULL DEFAULT 0,
  "text" TEXT,
  "userId" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "LumaQuestionLog_audience_intent_idx" ON "LumaQuestionLog" ("audience","intent","createdAt");
