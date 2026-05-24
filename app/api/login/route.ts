import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "auth_token";
const COOKIE_VALUE = "findash_authenticated";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const expected = process.env.DASHBOARD_PASSWORD;

  if (!expected) {
    // No password set — open access in dev
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, COOKIE_VALUE, { httpOnly: true, sameSite: "strict", maxAge: MAX_AGE, path: "/" });
    return res;
  }

  if (password !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, COOKIE_VALUE, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
  return res;
}
