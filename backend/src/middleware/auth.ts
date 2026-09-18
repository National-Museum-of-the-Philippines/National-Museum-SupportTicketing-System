import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { User, type UserDoc } from "../models/User.js";
import type { Role } from "../constants.js";
import { AppError } from "../utils/errors.js";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  division: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: UserDoc) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: "7d" },
  );
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError(401, "Authentication required");
    }
    const token = header.slice(7);
    const payload = jwt.verify(token, config.jwtSecret) as { sub: string };
    const user = await User.findById(payload.sub);
    if (!user || !user.active) throw new AppError(401, "Invalid session");
    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role as Role,
      division: user.division,
    };
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(new AppError(401, "Invalid or expired token"));
  }
}

export function requireRoles(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, "Authentication required"));
    // Super Admin may use Admin, Records, and Staff APIs.
    if (req.user.role === "super_admin") return next();
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, "Insufficient permissions"));
    }
    next();
  };
}

