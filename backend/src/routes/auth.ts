import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models/User.js";
import { requireAuth, signToken } from "../middleware/auth.js";
import { AppError } from "../utils/errors.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const profileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  division: z.string().trim().min(1).max(120),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(128),
});

function publicUser(user: {
  _id: { toString(): string };
  email: string;
  name: string;
  role: string;
  division?: string | null;
}) {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    division: user.division ?? "",
  };
}

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.active) throw new AppError(401, "Invalid credentials");
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new AppError(401, "Invalid credentials");
    const token = signToken(user);
    res.json({
      token,
      user: publicUser(user),
    });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const u = req.user!;
  res.json({
    user: {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      division: u.division,
    },
  });
});

authRouter.patch("/profile", requireAuth, async (req, res, next) => {
  try {
    const body = profileSchema.parse(req.body);
    const user = await User.findById(req.user!.id);
    if (!user || !user.active) throw new AppError(404, "User not found");

    user.name = body.name;
    user.division = body.division;
    await user.save();

    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const body = changePasswordSchema.parse(req.body);
    const user = await User.findById(req.user!.id);
    if (!user || !user.active) throw new AppError(404, "User not found");

    const ok = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!ok) throw new AppError(400, "Current password is incorrect");

    if (body.currentPassword === body.newPassword) {
      throw new AppError(400, "New password must be different from the current password");
    }

    user.passwordHash = await bcrypt.hash(body.newPassword, 10);
    await user.save();

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
