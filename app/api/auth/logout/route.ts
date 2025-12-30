import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth";

export async function POST() {
  await clearAuthCookie();

  return NextResponse.json({ success: true });
}

export async function GET() {
  await clearAuthCookie();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!;
  return NextResponse.redirect(`${baseUrl}/login`);
}
