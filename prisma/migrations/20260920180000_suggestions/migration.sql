CREATE TABLE "Suggestion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "creatorId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "reviewedById" TEXT,
  "reviewedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Suggestion_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Suggestion_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Suggestion_status_createdAt_idx" ON "Suggestion"("status", "createdAt");
CREATE INDEX "Suggestion_creatorId_createdAt_idx" ON "Suggestion"("creatorId", "createdAt");
