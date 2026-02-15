import { notifyAdminKYCSubmission } from '../src/services/notification.service.js';

async function testAdminKYCEmail() {
  console.log('🧪 Testing Admin KYC Notification Email...\n');

  try {
    await notifyAdminKYCSubmission(
      'Test User',
      'testuser@example.com',
      '123456789012345678901234', // fake user ID
      '987654321098765432109876', // fake KYC ID
      'passport',
      'United States'
    );

    console.log('\n✅ Test email sent successfully!');
    console.log('📧 Check your admin email inbox: ' + process.env.ADMIN_EMAIL);
    console.log('⚠️  If you don\'t see it, check your spam/junk folder');
  } catch (error) {
    console.error('\n❌ Test email failed:', error.message);
    console.error('\nPossible issues:');
    console.error('1. SMTP credentials incorrect in .env');
    console.error('2. Gmail blocking "less secure apps" - enable app password');
    console.error('3. Network/firewall blocking SMTP port 587');
    console.error('4. ADMIN_EMAIL not set in .env');
  }

  process.exit(0);
}

testAdminKYCEmail();
