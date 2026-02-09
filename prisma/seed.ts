import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clear existing data
  await prisma.referral.deleteMany();
  await prisma.fundOperation.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.userInvestment.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.transfer.deleteMany();
  await prisma.fileAttachment.deleteMany();
  await prisma.ticketMessage.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.session.deleteMany();
  await prisma.property.deleteMany();
  await prisma.user.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.testimonial.deleteMany();
  await prisma.investmentOption.deleteMany();

  // ── Landing Page: Team Members ──
  await prisma.teamMember.createMany({
    data: [
      {
        name: "Juan Alvarado",
        role: "CEO & Founder",
        image: "/images/team/member-1.jpg",
        instagram: "https://instagram.com/juanalvarado",
        order: 1,
      },
      {
        name: "Maria Santos",
        role: "Chief Investment Officer",
        image: "/images/team/member-2.jpg",
        instagram: "https://instagram.com/mariasantos",
        order: 2,
      },
      {
        name: "Carlos Rivera",
        role: "Head of Real Estate",
        image: "/images/team/member-3.jpg",
        instagram: "https://instagram.com/carlosrivera",
        order: 3,
      },
      {
        name: "Ana Rodriguez",
        role: "Chief Financial Officer",
        image: "/images/team/member-4.jpg",
        instagram: "https://instagram.com/anarodriguez",
        order: 4,
      },
      {
        name: "Diego Martinez",
        role: "VP of Operations",
        image: "/images/team/member-5.jpg",
        instagram: "https://instagram.com/diegomartinez",
        order: 5,
      },
      {
        name: "Sofia Hernandez",
        role: "Head of Marketing",
        image: "/images/team/member-6.jpg",
        instagram: "https://instagram.com/sofiahernandez",
        order: 6,
      },
      {
        name: "Luis Gomez",
        role: "Lead Developer",
        image: "/images/team/member-7.jpg",
        instagram: "https://instagram.com/luisgomez",
        order: 7,
      },
    ],
  });
  console.log("  ✓ Team members seeded");

  // ── Landing Page: Testimonials ──
  await prisma.testimonial.createMany({
    data: [
      {
        name: "Sarah Johnson",
        designation: "Investor since 2022",
        content:
          "Alvarado has completely transformed my investment portfolio. The returns have been exceptional and the team is incredibly professional.",
        image: "/images/testimonials/auth-01.png",
        star: 5,
      },
      {
        name: "Michael Chen",
        designation: "Real Estate Investor",
        content:
          "I've been investing in real estate for 10 years, but Alvarado's platform made it effortless. Highly recommend to anyone looking to diversify.",
        image: "/images/testimonials/auth-02.png",
        star: 5,
      },
      {
        name: "David Thompson",
        designation: "Portfolio Manager",
        content:
          "The transparency and security Alvarado provides is unmatched. I can track all my investments in real-time with full confidence.",
        image: "/images/testimonials/auth-03.png",
        star: 4,
      },
    ],
  });
  console.log("  ✓ Testimonials seeded");

  // ── Landing Page: Investment Options ──
  const investmentOptions = await Promise.all([
    prisma.investmentOption.create({
      data: {
        title: "Share Acquisition",
        image: "/images/investment/entire-ownership.jpg",
        minInvestment: "$500",
        description:
          "Invest in premium real estate shares with guaranteed returns and professional management.",
        link: "/dashboard/investments",
        order: 1,
      },
    }),
    prisma.investmentOption.create({
      data: {
        title: "Direct Property Investment",
        image: "/images/investment/mortgage-backed.jpg",
        minInvestment: "$10,000",
        description:
          "Own a piece of carefully selected premium properties in high-growth markets.",
        link: "/dashboard/investments",
        order: 2,
      },
    }),
  ]);
  console.log("  ✓ Investment options seeded");

  // ── Properties ──
  await prisma.property.createMany({
    data: [
      {
        title: "Luxury Condo Downtown Miami",
        images: ["/images/properties/property-01.jpg"],
        location: "Miami, FL",
        price: 450000,
        type: "residential",
        category: "airbnb",
        investmentType: "individual",
        minInvestment: 5000,
        maxInvestment: 450000,
        targetAmount: 450000,
        currentFunded: 180000,
        investorCount: 12,
        expectedROI: 18,
        monthlyReturn: 1.5,
        duration: 24,
        bedrooms: 2,
        bathrooms: 2,
        parking: 1,
        sqft: 1200,
        description: "Modern luxury condo with ocean views in the heart of downtown Miami.",
        features: ["Ocean View", "Pool", "Gym", "Concierge", "Parking"],
        investmentStatus: "available",
        riskLevel: "low",
        isFeatured: true,
      },
      {
        title: "Commercial Office Space Austin",
        images: ["/images/properties/property-02.jpg"],
        location: "Austin, TX",
        price: 850000,
        type: "commercial",
        category: "mortgage",
        investmentType: "pooled",
        minInvestment: 2500,
        maxInvestment: 50000,
        targetAmount: 850000,
        currentFunded: 425000,
        investorCount: 34,
        expectedROI: 14,
        monthlyReturn: 1.17,
        duration: 36,
        bedrooms: 0,
        bathrooms: 4,
        parking: 20,
        sqft: 3500,
        description: "Premium office space in Austin's tech corridor with high rental yield.",
        features: ["Open Floor Plan", "Conference Rooms", "Parking Garage", "Fiber Internet"],
        investmentStatus: "available",
        riskLevel: "medium",
        isFeatured: true,
      },
      {
        title: "Beachfront Villa Cancun",
        images: ["/images/properties/property-03.jpg"],
        location: "Cancun, Mexico",
        price: 1200000,
        type: "residential",
        category: "arbitrage",
        investmentType: "individual",
        minInvestment: 10000,
        maxInvestment: 1200000,
        targetAmount: 1200000,
        currentFunded: 0,
        investorCount: 0,
        expectedROI: 22,
        monthlyReturn: 1.83,
        duration: 18,
        bedrooms: 4,
        bathrooms: 3,
        parking: 2,
        sqft: 2800,
        description: "Stunning beachfront villa with private pool and direct beach access.",
        features: ["Beachfront", "Private Pool", "Garden", "Security", "Furnished"],
        investmentStatus: "available",
        riskLevel: "high",
        isFeatured: true,
      },
    ],
  });
  console.log("  ✓ Properties seeded");

  // ── Demo User ──
  const passwordHash = await bcrypt.hash("Demo1234!", 12);

  const demoUser = await prisma.user.create({
    data: {
      email: "demo@alvarado.com",
      passwordHash,
      firstName: "Demo",
      lastName: "User",
      phone: "+1 (555) 123-4567",
      nationality: "American",
      address: "123 Main Street",
      city: "Miami",
      state: "FL",
      postalCode: "33101",
      country: "United States",
      bio: "Real estate investment enthusiast",
      occupation: "Software Engineer",
      role: "user",
      emailVerified: true,
      kycStatus: "verified",
      balance: 25000,
      referralCode: "DEMO2024",
    },
  });
  console.log("  ✓ Demo user created (demo@alvarado.com / Demo1234!)");

  // ── User Settings ──
  await prisma.userSettings.create({
    data: {
      userId: demoUser.id,
      emailNotifications: true,
      pushNotifications: true,
      marketingEmails: false,
      loginAlerts: true,
      sessionTimeout: 30,
    },
  });
  console.log("  ✓ User settings seeded");

  // ── Sample Transactions ──
  await prisma.transaction.createMany({
    data: [
      {
        userId: demoUser.id,
        type: "deposit",
        amount: 10000,
        status: "completed",
        description: "Initial deposit via bank transfer",
        reference: "DEP-001",
      },
      {
        userId: demoUser.id,
        type: "deposit",
        amount: 15000,
        status: "completed",
        description: "Deposit via credit card",
        reference: "DEP-002",
      },
      {
        userId: demoUser.id,
        type: "investment",
        amount: -5000,
        status: "completed",
        description: "Investment in Share Acquisition",
        reference: "INV-001",
      },
      {
        userId: demoUser.id,
        type: "transfer_sent",
        amount: -500,
        status: "completed",
        description: "Transfer to john@example.com",
        reference: "TRF-001",
      },
      {
        userId: demoUser.id,
        type: "deposit",
        amount: 5500,
        status: "completed",
        description: "Deposit via crypto (BTC)",
        reference: "DEP-003",
      },
    ],
  });
  console.log("  ✓ Transactions seeded");

  // ── Sample Investment ──
  await prisma.userInvestment.create({
    data: {
      userId: demoUser.id,
      investmentOptionId: investmentOptions[0].id,
      amount: 5000,
      status: "active",
    },
  });
  console.log("  ✓ User investment seeded");

  // ── Sample Notifications ──
  await prisma.notification.createMany({
    data: [
      {
        userId: demoUser.id,
        type: "system",
        title: "Welcome to Alvarado",
        message: "Your account has been created successfully. Start exploring investment opportunities!",
      },
      {
        userId: demoUser.id,
        type: "security",
        title: "KYC Verified",
        message: "Your identity has been verified. You now have full access to all features.",
        isRead: true,
      },
      {
        userId: demoUser.id,
        type: "investment",
        title: "Investment Confirmed",
        message: "Your $5,000 investment in Share Acquisition has been confirmed.",
        isRead: true,
      },
      {
        userId: demoUser.id,
        type: "transfer",
        title: "Transfer Successful",
        message: "You sent $500 to john@example.com successfully.",
      },
    ],
  });
  console.log("  ✓ Notifications seeded");

  // ── Sample Support Ticket ──
  const ticket = await prisma.supportTicket.create({
    data: {
      userId: demoUser.id,
      subject: "Question about investment returns",
      category: "Investments",
      priority: "medium",
      status: "open",
    },
  });

  await prisma.ticketMessage.create({
    data: {
      ticketId: ticket.id,
      senderId: demoUser.id,
      senderType: "user",
      message: "Hi, I'd like to know more about the expected returns on the Share Acquisition plan. Can you provide more details?",
    },
  });
  console.log("  ✓ Support ticket seeded");

  // ── Sample Fund Operations ──
  await prisma.fundOperation.createMany({
    data: [
      {
        userId: demoUser.id,
        type: "deposit",
        method: "bank",
        amount: 10000,
        fee: 0,
        status: "completed",
        details: JSON.stringify({ bankName: "Chase", accountLast4: "4567" }),
        reference: "FUND-001",
      },
      {
        userId: demoUser.id,
        type: "deposit",
        method: "card",
        amount: 15000,
        fee: 150,
        status: "completed",
        details: JSON.stringify({ cardLast4: "8901", cardBrand: "Visa" }),
        reference: "FUND-002",
      },
      {
        userId: demoUser.id,
        type: "deposit",
        method: "crypto",
        amount: 5500,
        fee: 0,
        status: "completed",
        details: JSON.stringify({ wallet: "bc1q...xyz", network: "Bitcoin" }),
        reference: "FUND-003",
      },
    ],
  });
  console.log("  ✓ Fund operations seeded");

  console.log("\nSeed complete!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
