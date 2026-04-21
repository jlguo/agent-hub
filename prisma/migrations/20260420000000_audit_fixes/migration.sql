-- CreateTable
CREATE TABLE "DiscussionParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discussionId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscussionParticipant_discussionId_fkey" FOREIGN KEY ("discussionId") REFERENCES "Discussion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DiscussionParticipant_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "archivedAt" DATETIME,
    CONSTRAINT "Discussion_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Discussion" ("archivedAt", "createdAt", "heatScore", "id", "roomId", "status", "topic", "updatedAt") SELECT "archivedAt", "createdAt", "heatScore", "id", "roomId", "status", "topic", "updatedAt" FROM "Discussion";
DROP TABLE "Discussion";
ALTER TABLE "new_Discussion" RENAME TO "Discussion";
CREATE INDEX "Discussion_roomId_status_idx" ON "Discussion"("roomId", "status");
CREATE INDEX "Discussion_roomId_createdAt_idx" ON "Discussion"("roomId", "createdAt");
CREATE TABLE "new_Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'family',
    "description" TEXT,
    "context" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "externalChatId" TEXT
);
INSERT INTO "new_Room" ("context", "createdAt", "description", "externalChatId", "id", "name", "type", "updatedAt") SELECT "context", "createdAt", "description", "externalChatId", "id", "name", "type", "updatedAt" FROM "Room";
DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DiscussionParticipant_agentId_idx" ON "DiscussionParticipant"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscussionParticipant_discussionId_agentId_key" ON "DiscussionParticipant"("discussionId", "agentId");

-- CreateIndex
CREATE INDEX "Relationship_agentBId_idx" ON "Relationship"("agentBId");

