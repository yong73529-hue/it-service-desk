ALTER TABLE "Ticket" ADD COLUMN "satisfactionRating" INTEGER;
ALTER TABLE "Ticket" ADD COLUMN "satisfactionComment" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "reopenedAt" DATETIME;
ALTER TABLE "Ticket" ADD COLUMN "reopenedCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "KnowledgeArticle" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ticketId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "symptoms" TEXT NOT NULL,
  "cause" TEXT NOT NULL,
  "resolution" TEXT NOT NULL,
  "keywords" TEXT,
  "publishedById" TEXT NOT NULL,
  "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "KnowledgeArticle_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "KnowledgeArticle_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "KnowledgeArticle_ticketId_key" ON "KnowledgeArticle"("ticketId");
CREATE INDEX "KnowledgeArticle_category_publishedAt_idx" ON "KnowledgeArticle"("category", "publishedAt");

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "detail" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
