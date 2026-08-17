-- CreateTable
CREATE TABLE "app_license" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trialStartedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trialHighWaterMark" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clockAnomalyDetected" BOOLEAN NOT NULL DEFAULT false,
    "licenseKey" TEXT,
    "activatedAt" DATETIME,
    "integrityHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
