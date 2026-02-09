import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { success, error } from "../../utils/response.js";

export async function getAll(req: Request, res: Response) {
  try {
    const members = await prisma.teamMember.findMany({
      orderBy: { order: "asc" },
    });
    return success(res, members);
  } catch (err) {
    return error(res, "Failed to fetch team members", 500);
  }
}

export async function create(req: Request, res: Response) {
  try {
    const member = await prisma.teamMember.create({
      data: req.body,
    });
    return success(res, member, "Team member created", 201);
  } catch (err) {
    return error(res, "Failed to create team member", 500);
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const existing = await prisma.teamMember.findUnique({ where: { id } });
    if (!existing) {
      return error(res, "Team member not found", 404);
    }

    const member = await prisma.teamMember.update({
      where: { id },
      data: req.body,
    });
    return success(res, member, "Team member updated");
  } catch (err) {
    return error(res, "Failed to update team member", 500);
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const existing = await prisma.teamMember.findUnique({ where: { id } });
    if (!existing) {
      return error(res, "Team member not found", 404);
    }

    const member = await prisma.teamMember.update({
      where: { id },
      data: { isActive: false },
    });
    return success(res, member, "Team member deleted");
  } catch (err) {
    return error(res, "Failed to delete team member", 500);
  }
}
