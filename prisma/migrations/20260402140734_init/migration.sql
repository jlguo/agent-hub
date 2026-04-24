/*
  Warnings:

  - You are about to drop the column `endedAt` on the `Discussion` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `Message` table. All the data in the column will be lost.
  - Added the required column `senderType` to the `Message` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Room" ADD COLUMN "externalChatId" TEXT;

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "lastUsedAt" DATETIME NOT NULL,
    CONSTRAINT "Session_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Discussion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "heatScore" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "participants" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "archivedAt" DATETIME,
    CONSTRAINT "Discussion_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Discussion" ("createdAt", "heatScore", "id", "participants", "roomId", "status", "topic", "updatedAt") SELECT "createdAt", "heatScore", "id", "participants", "roomId", "status", "topic", "updatedAt" FROM "Discussion";
DROP TABLE "Discussion";
ALTER TABLE "new_Discussion" RENAME TO "Discussion";
CREATE INDEX "Discussion_roomId_status_idx" ON "Discussion"("roomId", "status");
CREATE INDEX "Discussion_roomId_createdAt_idx" ON "Discussion"("roomId", "createdAt");
CREATE TABLE "new_Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "agentId" TEXT,
    "discussionId" TEXT,
    "senderType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Message_discussionId_fkey" FOREIGN KEY ("discussionId") REFERENCES "Discussion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("agentId", "content", "createdAt", "id", "metadata", "roomId") SELECT "agentId", "content", "createdAt", "id", "metadata", "roomId" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
CREATE INDEX "Message_roomId_createdAt_idx" ON "Message"("roomId", "createdAt");
CREATE INDEX "Message_discussionId_createdAt_idx" ON "Message"("discussionId", "createdAt");
CREATE INDEX "Message_agentId_createdAt_idx" ON "Message"("agentId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionId_key" ON "Session"("sessionId");

-- CreateIndex
CREATE INDEX "Session_roomId_status_idx" ON "Session"("roomId", "status");
