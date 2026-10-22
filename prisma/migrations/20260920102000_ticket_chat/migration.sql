-- Preserve existing processing records while introducing ticket conversations.
ALTER TABLE "TicketComment" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'CHAT';
ALTER TABLE "TicketComment" ADD COLUMN "readByCreatorAt" DATETIME;
ALTER TABLE "TicketComment" ADD COLUMN "readByOpsAt" DATETIME;
UPDATE "TicketComment" SET "kind" = 'PROCESS_LOG';

CREATE TABLE "TicketCommentAttachment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "commentId" TEXT NOT NULL,
  "uploaderId" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketCommentAttachment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "TicketComment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TicketCommentAttachment_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "TicketCommentAttachment_commentId_idx" ON "TicketCommentAttachment"("commentId");
