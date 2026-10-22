CREATE TABLE "Role" ("id" TEXT NOT NULL PRIMARY KEY, "code" TEXT NOT NULL, "name" TEXT NOT NULL);
CREATE TABLE "Department" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "email" TEXT, "phone" TEXT, "wecomUserId" TEXT,
  "roleId" TEXT NOT NULL, "departmentId" TEXT, "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "Ticket" (
  "id" TEXT NOT NULL PRIMARY KEY, "ticketNo" TEXT NOT NULL, "creatorId" TEXT NOT NULL, "departmentId" TEXT NOT NULL,
  "contactPhone" TEXT, "category" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT NOT NULL,
  "location" TEXT NOT NULL, "device" TEXT NOT NULL, "priority" TEXT NOT NULL DEFAULT 'NORMAL', "emergencyReason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING', "assignedToId" TEXT, "currentSort" INTEGER NOT NULL,
  "cause" TEXT, "resolution" TEXT, "result" TEXT, "replacedDevice" TEXT, "completionNote" TEXT, "userConfirmedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  "acceptedAt" DATETIME, "startedAt" DATETIME, "completedAt" DATETIME, "cancelledAt" DATETIME,
  CONSTRAINT "Ticket_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Ticket_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Ticket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "TicketLog" (
  "id" TEXT NOT NULL PRIMARY KEY, "ticketId" TEXT NOT NULL, "operatorId" TEXT NOT NULL, "action" TEXT NOT NULL,
  "fromStatus" TEXT, "toStatus" TEXT, "note" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketLog_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TicketLog_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "TicketAttachment" (
  "id" TEXT NOT NULL PRIMARY KEY, "ticketId" TEXT NOT NULL, "uploaderId" TEXT NOT NULL, "originalName" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "size" INTEGER NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TicketAttachment_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "TicketComment" (
  "id" TEXT NOT NULL PRIMARY KEY, "ticketId" TEXT NOT NULL, "authorId" TEXT NOT NULL, "content" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TicketComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_wecomUserId_key" ON "User"("wecomUserId");
CREATE UNIQUE INDEX "Ticket_ticketNo_key" ON "Ticket"("ticketNo");
CREATE INDEX "Ticket_status_currentSort_idx" ON "Ticket"("status", "currentSort");
CREATE INDEX "Ticket_creatorId_createdAt_idx" ON "Ticket"("creatorId", "createdAt");
CREATE INDEX "Ticket_departmentId_createdAt_idx" ON "Ticket"("departmentId", "createdAt");
CREATE INDEX "Ticket_category_createdAt_idx" ON "Ticket"("category", "createdAt");
CREATE INDEX "TicketLog_ticketId_createdAt_idx" ON "TicketLog"("ticketId", "createdAt");
CREATE INDEX "TicketComment_ticketId_createdAt_idx" ON "TicketComment"("ticketId", "createdAt");
