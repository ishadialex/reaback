import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding investment properties...");

  // Remove existing properties first (won't touch users/investments/etc.)
  await prisma.property.deleteMany();

  await prisma.property.createMany({
    data: [
      {
        title: "Luxury Condo Downtown Miami",
        images: [
          "/images/properties/property-01.jpg",
          "/images/properties/property-01b.jpg",
        ],
        location: "Miami, FL",
        price: 450000,
        type: "residential",
        category: "airbnb",
        investmentType: "pooled",
        minInvestment: 2500,
        maxInvestment: 50000,
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
        description:
          "Modern luxury condo with stunning ocean views in the heart of downtown Miami. This Airbnb-optimized property generates consistent short-term rental income year-round.",
        features: ["Ocean View", "Pool", "Gym", "Concierge", "Parking", "Smart Home"],
        investmentStatus: "available",
        riskLevel: "low",
        isFeatured: true,
      },
      {
        title: "Commercial Office Space Austin",
        images: [
          "/images/properties/property-02.jpg",
        ],
        location: "Austin, TX",
        price: 850000,
        type: "commercial",
        category: "mortgage",
        investmentType: "pooled",
        minInvestment: 1000,
        maxInvestment: 25000,
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
        description:
          "Premium office space in Austin's booming tech corridor. Long-term lease with a Fortune 500 tenant ensures stable monthly returns backed by a mortgage-secured structure.",
        features: ["Open Floor Plan", "Conference Rooms", "Parking Garage", "Fiber Internet", "24/7 Security"],
        investmentStatus: "available",
        riskLevel: "low",
        isFeatured: true,
      },
      {
        title: "Beachfront Villa Cancun",
        images: [
          "/images/properties/property-03.jpg",
        ],
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
        description:
          "Stunning beachfront villa in Cancun's hotel zone with private pool and direct beach access. Prime arbitrage opportunity in one of Mexico's top tourist destinations.",
        features: ["Beachfront", "Private Pool", "Garden", "Security", "Furnished", "Staff Quarters"],
        investmentStatus: "available",
        riskLevel: "medium",
        isFeatured: false,
      },
      {
        title: "Manhattan Penthouse Suite",
        images: [
          "/images/properties/property-04.jpg",
        ],
        location: "New York, NY",
        price: 3500000,
        type: "residential",
        category: "airbnb",
        investmentType: "pooled",
        minInvestment: 5000,
        maxInvestment: 100000,
        targetAmount: 3500000,
        currentFunded: 2100000,
        investorCount: 58,
        expectedROI: 16,
        monthlyReturn: 1.33,
        duration: 30,
        bedrooms: 3,
        bathrooms: 3,
        parking: 1,
        sqft: 2200,
        description:
          "Iconic Manhattan penthouse with panoramic city views. High-demand Airbnb listing in Midtown Manhattan generating premium nightly rates.",
        features: ["Rooftop Terrace", "City Views", "Doorman", "Gym", "Concierge", "Valet Parking"],
        investmentStatus: "available",
        riskLevel: "medium",
        isFeatured: true,
      },
      {
        title: "Miami Beach Vacation Rental",
        images: [
          "/images/properties/property-05.jpg",
        ],
        location: "Miami Beach, FL",
        price: 680000,
        type: "residential",
        category: "airbnb",
        investmentType: "individual",
        minInvestment: 5000,
        maxInvestment: 680000,
        targetAmount: 680000,
        currentFunded: 680000,
        investorCount: 1,
        expectedROI: 20,
        monthlyReturn: 1.67,
        duration: 12,
        bedrooms: 3,
        bathrooms: 2,
        parking: 1,
        sqft: 1600,
        description:
          "Fully furnished vacation rental steps from South Beach. Consistently ranked among Miami's top Airbnb properties with 95% occupancy.",
        features: ["Steps from Beach", "Rooftop Pool", "Fully Furnished", "BBQ Area", "Parking"],
        investmentStatus: "fully-funded",
        riskLevel: "low",
        isFeatured: false,
      },
      {
        title: "Dubai Marina Smart Apartment",
        images: [
          "/images/properties/property-06.jpg",
        ],
        location: "Dubai, UAE",
        price: 920000,
        type: "residential",
        category: "mortgage",
        investmentType: "pooled",
        minInvestment: 1000,
        maxInvestment: 30000,
        targetAmount: 920000,
        currentFunded: 0,
        investorCount: 0,
        expectedROI: 12,
        monthlyReturn: 1.0,
        duration: 48,
        bedrooms: 2,
        bathrooms: 2,
        parking: 1,
        sqft: 1400,
        description:
          "Modern smart apartment in Dubai Marina with marina views. Tax-free returns in one of the world's most investor-friendly markets.",
        features: ["Marina View", "Smart Home", "Infinity Pool", "Gym", "Concierge", "24/7 Security"],
        investmentStatus: "coming-soon",
        riskLevel: "low",
        isFeatured: true,
      },
    ],
  });

  console.log("  ✓ 6 investment properties seeded");
  console.log("\nDone! Run the backend and visit /dashboard/property-market/properties");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
