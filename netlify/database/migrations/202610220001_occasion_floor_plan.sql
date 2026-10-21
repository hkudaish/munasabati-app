-- Additive, idempotent: the hall layout (tables, chairs, seating) of an occasion, saved as one versioned document.
CREATE TABLE IF NOT EXISTS "OccasionFloorPlan" (
  "occasionId" TEXT NOT NULL PRIMARY KEY,
  "layout" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OccasionFloorPlan_occasionId_fkey" FOREIGN KEY ("occasionId") REFERENCES "Occasion"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
