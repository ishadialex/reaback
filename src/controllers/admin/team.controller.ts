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
    const file = (req as any).file;

    // image can come from an uploaded file OR a URL string in the body
    const image: string | undefined = file?.path ?? req.body.image;

    if (!image) {
      return error(res, "Image is required (upload a file or provide an image URL)", 400);
    }

    const { name, role, instagram, order } = req.body;

    const member = await prisma.teamMember.create({
      data: {
        name,
        role,
        image,
        instagram: instagram || null,
        order: order !== undefined ? Number(order) : 0,
      },
    });

    return success(res, member, "Team member created", 201);
  } catch (err) {
    return error(res, "Failed to create team member", 500);
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const file = (req as any).file;

    const existing = await prisma.teamMember.findUnique({ where: { id } });
    if (!existing) {
      return error(res, "Team member not found", 404);
    }

    const data: Record<string, unknown> = {};

    if (req.body.name !== undefined) data.name = req.body.name;
    if (req.body.role !== undefined) data.role = req.body.role;
    if (req.body.instagram !== undefined) data.instagram = req.body.instagram || null;
    if (req.body.order !== undefined) data.order = Number(req.body.order);
    if (req.body.isActive !== undefined) data.isActive = req.body.isActive === "true" || req.body.isActive === true;

    // New uploaded file takes priority over URL in body
    if (file?.path) {
      data.image = file.path;
    } else if (req.body.image) {
      data.image = req.body.image;
    }

    const member = await prisma.teamMember.update({
      where: { id },
      data,
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
