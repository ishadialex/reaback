import { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { success, error } from "../utils/response.js";

export async function getTeamMembers(_req: Request, res: Response) {
  try {
    const members = await prisma.teamMember.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        role: true,
        image: true,
        instagram: true,
      },
    });

    return success(res, members);
  } catch (err) {
    console.error("getTeamMembers error:", err);
    return error(res, "Failed to fetch team members", 500);
  }
}

export async function getTestimonials(_req: Request, res: Response) {
  try {
    const testimonials = await prisma.testimonial.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        designation: true,
        content: true,
        image: true,
        star: true,
      },
    });

    return success(res, testimonials);
  } catch (err) {
    console.error("getTestimonials error:", err);
    return error(res, "Failed to fetch testimonials", 500);
  }
}

export async function getInvestmentOptions(_req: Request, res: Response) {
  try {
    const options = await prisma.investmentOption.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      select: {
        id: true,
        title: true,
        image: true,
        minInvestment: true,
        description: true,
        link: true,
      },
    });

    return success(res, options);
  } catch (err) {
    console.error("getInvestmentOptions error:", err);
    return error(res, "Failed to fetch investment options", 500);
  }
}
