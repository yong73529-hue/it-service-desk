PRAGMA foreign_keys=OFF;
CREATE TABLE "new_KnowledgeArticle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "symptoms" TEXT NOT NULL,
    "cause" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "keywords" TEXT,
    "sourceName" TEXT,
    "publishedById" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KnowledgeArticle_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "KnowledgeArticle_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_KnowledgeArticle" ("id","ticketId","title","category","symptoms","cause","resolution","keywords","publishedById","publishedAt","updatedAt") SELECT "id","ticketId","title","category","symptoms","cause","resolution","keywords","publishedById","publishedAt","updatedAt" FROM "KnowledgeArticle";
DROP TABLE "KnowledgeArticle";
ALTER TABLE "new_KnowledgeArticle" RENAME TO "KnowledgeArticle";
CREATE UNIQUE INDEX "KnowledgeArticle_ticketId_key" ON "KnowledgeArticle"("ticketId");
CREATE INDEX "KnowledgeArticle_category_publishedAt_idx" ON "KnowledgeArticle"("category", "publishedAt");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
