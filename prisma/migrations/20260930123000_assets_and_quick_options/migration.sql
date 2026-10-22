-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "brandModel" TEXT,
    "serialNumber" TEXT,
    "location" TEXT NOT NULL,
    "departmentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Asset_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "QuickOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

ALTER TABLE "Ticket" ADD COLUMN "assetId" TEXT REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Asset_assetNo_key" ON "Asset"("assetNo");
CREATE UNIQUE INDEX "Asset_serialNumber_key" ON "Asset"("serialNumber");
CREATE INDEX "Asset_category_status_idx" ON "Asset"("category", "status");
CREATE INDEX "Asset_location_idx" ON "Asset"("location");
CREATE UNIQUE INDEX "QuickOption_type_label_key" ON "QuickOption"("type", "label");
CREATE INDEX "QuickOption_type_active_sortOrder_idx" ON "QuickOption"("type", "active", "sortOrder");
CREATE INDEX "Ticket_assetId_createdAt_idx" ON "Ticket"("assetId", "createdAt");

INSERT INTO "QuickOption" ("id","type","label","active","sortOrder","createdAt","updatedAt") VALUES
('qo_device_macmini','DEVICE','Mac Mini',true,10,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('qo_device_laptop','DEVICE','笔记本电脑',true,20,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('qo_device_projector','DEVICE','投影仪',true,30,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('qo_device_printer','DEVICE','打印机',true,40,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('qo_device_network','DEVICE','网络设备',true,50,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('qo_location_2616','LOCATION','2616 教室',true,10,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('qo_location_office','LOCATION','办公室',true,20,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('qo_location_meeting','LOCATION','会议室',true,30,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('qo_location_server','LOCATION','机房',true,40,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
