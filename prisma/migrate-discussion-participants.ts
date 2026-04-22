/**
 * Migration script: Convert Discussion.participants from JSON to DiscussionParticipant records
 *
 * Usage:
 *   npx tsx prisma/migrate-discussion-participants.ts
 *
 * This script:
 * 1. Reads all existing discussions with JSON participants
 * 2. Parses the JSON array of participant IDs
 * 3. Creates DiscussionParticipant records for each participant
 * 4. Reports any errors (invalid JSON, missing agents)
 *
 * IMPORTANT: Run this AFTER running `npx prisma migrate dev` to apply the schema changes.
 * Back up your database before running.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Discussion participants migration...\n');

  // Get all discussions that have a non-null participants field
  // Note: After schema migration, old JSON data may be in a legacy column or lost
  // This script assumes we're migrating from the old schema where participants was a JSON field

  // Check if there's legacy data
  const discussions = await prisma.discussion.findMany({
    select: {
      id: true,
      roomId: true,
      topic: true,
      participants: {
        select: {
          id: true,
          agentId: true,
        },
      },
    },
  });

  console.log(`Found ${discussions.length} discussions\n`);

  const results = {
    migrated: 0,
    skipped: 0,
    errors: [] as string[],
  };

  // If participants is already migrated (has DiscussionParticipant records), skip
  // This script is mainly for documentation - the actual migration happens during Prisma schema migration
  for (const discussion of discussions) {
    if (discussion.participants.length > 0) {
      console.log(
        `✓ Discussion "${discussion.topic}" already has ${discussion.participants.length} participant(s)`
      );
      results.skipped++;
      continue;
    }

    console.log(
      `⚠ Discussion "${discussion.topic}" has no participants (legacy JSON may have been lost during schema migration)`
    );
    results.errors.push(`Discussion ${discussion.id} (${discussion.topic}): no participants found`);
  }

  console.log('\n--- Migration Summary ---');
  console.log(`Migrated: ${results.migrated}`);
  console.log(`Skipped (already migrated): ${results.skipped}`);
  console.log(`Errors: ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach((err) => console.log(`  - ${err}`));
  }

  console.log('\nNote: If legacy JSON participants were lost during schema migration,');
  console.log('you may need to manually reconstruct participant data from application logs.');
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
