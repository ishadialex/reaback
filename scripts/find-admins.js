import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findAdmins() {
  try {
    const admins = await prisma.user.findMany({
      where: {
        OR: [
          { role: 'admin' },
          { role: 'superadmin' }
        ]
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        emailVerified: true,
        twoFactorEnabled: true,
        kycStatus: true,
        createdAt: true,
        accounts: {
          select: {
            provider: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (admins.length === 0) {
      console.log('\n❌ No admin users found in database!\n');
      console.log('To create an admin user, you can:');
      console.log('1. Register a new user via the API');
      console.log('2. Update their role to "admin" in the database\n');
    } else {
      console.log(`\n✅ Found ${admins.length} admin user(s):\n`);
      console.log('='.repeat(80));
      admins.forEach((admin, index) => {
        console.log(`\n${index + 1}. Admin Account:`);
        console.log(`   Email: ${admin.email}`);
        console.log(`   Name: ${admin.firstName} ${admin.lastName}`);
        console.log(`   Role: ${admin.role}`);
        console.log(`   User ID: ${admin.id}`);
        console.log(`   Email Verified: ${admin.emailVerified ? '✅' : '❌'}`);
        console.log(`   2FA Enabled: ${admin.twoFactorEnabled ? '✅' : '❌'}`);
        console.log(`   KYC Status: ${admin.kycStatus}`);
        console.log(`   Created: ${admin.createdAt.toISOString()}`);
        if (admin.accounts.length > 0) {
          console.log(`   Auth Providers: ${admin.accounts.map(a => a.provider).join(', ')}`);
        }
      });
      console.log('\n' + '='.repeat(80));
      console.log('\nℹ️  Use this email to login as admin in Postman');
      console.log('ℹ️  If you forgot the password, you can reset it via the database or reset password flow\n');
    }
  } catch (error) {
    console.error('Error finding admins:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findAdmins();
