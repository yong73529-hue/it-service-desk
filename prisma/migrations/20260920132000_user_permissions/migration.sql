CREATE TABLE "UserPermission" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "roleCode" TEXT NOT NULL,
  "grantedById" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserPermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UserPermission_userId_roleCode_key" ON "UserPermission"("userId", "roleCode");
CREATE INDEX "UserPermission_roleCode_idx" ON "UserPermission"("roleCode");
