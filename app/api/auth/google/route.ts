import { NextResponse } from "next/server";
// import { getGoogleAuthUrl } from "@/lib/auth";

// Google OAuth is temporarily disabled
// Uncomment this code when you have GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET configured

export async function GET() {
  // const authUrl = getGoogleAuthUrl();
  // return NextResponse.redirect(authUrl);

  return NextResponse.json(
    {
      success: false,
      error: "Google authentication is not configured. Please use email/password login."
    },
    { status: 503 }
  );
}
