import { NextRequest, NextResponse } from "next/server";
// import { connectDB } from "@/lib/db";
// import { User } from "@/models";
// import {
//   getGoogleTokens,
//   getGoogleUserInfo,
//   signToken,
//   setAuthCookie,
// } from "@/lib/auth";

// Google OAuth callback is temporarily disabled
// Uncomment this code when you have GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET configured

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Redirect to login with error since Google OAuth is not configured
  return NextResponse.redirect(`${baseUrl}/login?error=google_not_configured`);

  /* Original Google OAuth callback code - uncomment when credentials are available:

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  // Handle error from Google
  if (error) {
    return NextResponse.redirect(`${baseUrl}/login?error=${error}`);
  }

  // No code provided
  if (!code) {
    return NextResponse.redirect(`${baseUrl}/login?error=no_code`);
  }

  try {
    // Exchange code for tokens
    const tokens = await getGoogleTokens(code);

    // Get user info from Google
    const googleUser = await getGoogleUserInfo(tokens.access_token);

    // Connect to database
    await connectDB();

    // Find or create user
    let user = await User.findOne({ googleId: googleUser.id });

    if (!user) {
      user = await User.create({
        googleId: googleUser.id,
        email: googleUser.email,
        name: googleUser.name,
        avatar: googleUser.picture,
      });
    } else {
      // Update user info if changed
      user.name = googleUser.name;
      user.avatar = googleUser.picture;
      await user.save();
    }

    // Create JWT token
    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
    });

    // Set auth cookie
    await setAuthCookie(token);

    // Redirect to dashboard
    return NextResponse.redirect(`${baseUrl}/dashboard`);
  } catch (err) {
    console.error("Google auth callback error:", err);
    return NextResponse.redirect(`${baseUrl}/login?error=auth_failed`);
  }
  */
}
