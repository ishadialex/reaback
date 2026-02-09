import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import readline from "node:readline";

const prisma = new PrismaClient();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function main() {
  console.log("\n🔐 Admin User Setup");
  console.log("=".repeat(50));

  const email = await question("\nAdmin Email: ");
  const password = await question("Admin Password: ");
  const firstName = await question("First Name: ");
  const lastName = await question("Last Name: ");

  console.log("\nCreating admin user...");

  // Check if user already exists
  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (existing) {
    console.log("\n⚠️  User with this email already exists.");
    const update = await question("Update their role to superadmin? (y/n): ");

    if (update.toLowerCase() === "y") {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: "superadmin" },
      });
      console.log("\n✅ User role updated to superadmin!");
      console.log(`\nEmail: ${existing.email}`);
      console.log(`Name: ${existing.firstName} ${existing.lastName}`);
      console.log(`Role: superadmin`);
    } else {
      console.log("\n❌ Cancelled.");
    }
  } else {
    // Create new admin user
    const passwordHash = await bcrypt.hash(password, 12);
    const referralCode = `ADMIN-${Date.now()}`;

    const admin = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: "superadmin",
        emailVerified: true,
        kycStatus: "verified",
        referralCode,
        balance: 0,
      },
    });

    // Create user settings
    await prisma.userSettings.create({
      data: {
        userId: admin.id,
        emailNotifications: true,
        pushNotifications: true,
        loginAlerts: true,
        sessionTimeout: 30,
      },
    });

    console.log("\n✅ Admin user created successfully!");
    console.log("\n" + "=".repeat(50));
    console.log("Admin Details:");
    console.log("=".repeat(50));
    console.log(`Email:    ${admin.email}`);
    console.log(`Name:     ${admin.firstName} ${admin.lastName}`);
    console.log(`Role:     ${admin.role}`);
    console.log(`ID:       ${admin.id}`);
    console.log("=".repeat(50));
    console.log("\n✨ You can now log in with these credentials");
    console.log("   and access all admin endpoints!\n");
  }

  rl.close();
}

main()
  .catch((e) => {
    console.error("\n❌ Error:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
