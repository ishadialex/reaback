import { prisma } from "../src/config/database.js";

/**
 * Migration Script: User Auth → Account Model
 *
 * Migrates existing users from the old single-provider system
 * (passwordHash, authProvider, googleId on User model)
 * to the new multi-provider Account model.
 */

async function migrateUsersToAccounts() {
  console.log("🚀 Starting migration to Account model...\n");

  try {
    // Fetch all users with their auth data
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        passwordHash: true,
        authProvider: true,
        googleId: true,
        accounts: true, // Check if already migrated
      },
    });

    console.log(`📊 Found ${users.length} users to process\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        // Check if user already has accounts (already migrated)
        if (user.accounts.length > 0) {
          console.log(`⏭️  ${user.email} - Already migrated (${user.accounts.length} account(s))`);
          skippedCount++;
          continue;
        }

        const accountsToCreate = [];

        // Migrate email/password users
        if (user.passwordHash) {
          accountsToCreate.push({
            userId: user.id,
            provider: "credentials",
            providerId: null,
            passwordHash: user.passwordHash,
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
          });
        }

        // Migrate Google OAuth users
        if (user.googleId) {
          accountsToCreate.push({
            userId: user.id,
            provider: "google",
            providerId: user.googleId,
            passwordHash: null,
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
          });
        }

        // Create Account records if we have any
        if (accountsToCreate.length > 0) {
          await prisma.account.createMany({
            data: accountsToCreate,
            skipDuplicates: true,
          });

          const methods = accountsToCreate.map(a => a.provider).join(" + ");
          console.log(`✅ ${user.email} - Migrated ${accountsToCreate.length} account(s): ${methods}`);
          migratedCount++;
        } else {
          console.log(`⚠️  ${user.email} - No auth data found (passwordHash or googleId missing)`);
          skippedCount++;
        }
      } catch (userError: any) {
        console.error(`❌ ${user.email} - Error:`, userError.message);
        errorCount++;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📈 Migration Summary:");
    console.log("=".repeat(60));
    console.log(`✅ Successfully migrated: ${migratedCount} users`);
    console.log(`⏭️  Skipped (already migrated): ${skippedCount} users`);
    console.log(`❌ Errors: ${errorCount} users`);
    console.log("=".repeat(60));
    console.log("\n🎉 Migration complete!\n");

    // Verify migration
    console.log("🔍 Verifying migration...");
    const accountCount = await prisma.account.count();
    console.log(`📊 Total accounts in database: ${accountCount}`);

  } catch (error) {
    console.error("💥 Migration failed:", error);
    throw error;
  }
}

// Run migration
migrateUsersToAccounts()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log("👋 Database connection closed");
  });
