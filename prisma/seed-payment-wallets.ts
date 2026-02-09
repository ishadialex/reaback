import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding payment wallets...');

  // Clear existing payment wallets (optional - remove if you want to keep existing ones)
  await prisma.paymentWallet.deleteMany({});
  console.log('✅ Cleared existing payment wallets');

  // Seed Bank Account
  const bankAccount = await prisma.paymentWallet.create({
    data: {
      type: 'bank',
      method: 'bank_transfer',
      name: 'Main Bank Account',
      address: '1234567890', // Account Number
      bankName: 'Wells Fargo',
      accountName: 'Alvarado Associates LLC',
      swiftCode: 'WFBIUS6S',
      routingNumber: '121000248',
      instructions: 'Please include your unique reference number in the transfer description to avoid delays in processing.',
      isActive: true,
    },
  });
  console.log('✅ Created bank account:', bankAccount.name);

  // Seed Crypto Wallets
  const cryptoWallets = [
    {
      type: 'crypto',
      method: 'BTC',
      name: 'Bitcoin Wallet',
      address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      network: 'Bitcoin Network',
      instructions: 'Minimum 3 network confirmations required. Only send BTC on Bitcoin Network.',
      isActive: true,
    },
    {
      type: 'crypto',
      method: 'ETH',
      name: 'Ethereum Wallet',
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      network: 'Ethereum Network (ERC20)',
      instructions: 'Only send ETH on Ethereum Mainnet. Gas fees apply.',
      isActive: true,
    },
    {
      type: 'crypto',
      method: 'USDT',
      name: 'Tether (USDT) Wallet',
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      network: 'ERC20 (Ethereum)',
      instructions: 'Send USDT only on ERC20 network. TRC20 deposits will be lost.',
      isActive: true,
    },
    {
      type: 'crypto',
      method: 'USDC',
      name: 'USD Coin Wallet',
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      network: 'ERC20 (Ethereum)',
      instructions: 'Only send USDC on ERC20 network. Minimum 12 confirmations required.',
      isActive: true,
    },
  ];

  for (const wallet of cryptoWallets) {
    const created = await prisma.paymentWallet.create({ data: wallet });
    console.log(`✅ Created ${wallet.method} wallet:`, created.name);
  }

  console.log('🎉 Payment wallets seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding payment wallets:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
