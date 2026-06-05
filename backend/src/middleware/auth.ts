import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = req.headers.authorization ?? "";
  if (!auth.startsWith("Bearer ")) {
    res.status(401).json({ detail: "Missing or invalid Authorization header" });
    return;
  }
  const token = auth.slice(7).trim();

  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SECRET_KEY ?? "";

  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ detail: "Server auth is not configured" });
    return;
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  const { data } = await admin.auth.getUser(token);
  if (!data.user) {
    res.status(401).json({ detail: "Invalid or expired token" });
    return;
  }

  // Guest/demo users sign in anonymously (Supabase sets is_anonymous=true).
  // They get a read-only view of the platform: allow safe reads, reject any
  // mutation. Enforced here, server-side, so the browser cannot bypass it.
  const isAnonymous = data.user.is_anonymous === true;
  const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(
    req.method.toUpperCase(),
  );
  if (isAnonymous && isWrite) {
    res.status(403).json({
      detail:
        "You're viewing a read-only demo. Create a free account to upload documents and make changes.",
    });
    return;
  }

  res.locals.userId = data.user.id;
  res.locals.userEmail = data.user.email?.toLowerCase() ?? "";
  res.locals.isAnonymous = isAnonymous;
  res.locals.token = token;
  next();
}
