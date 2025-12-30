import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import type { JwtPayload } from "@/types";

export type AuthenticatedRequest = NextRequest & {
  user: JwtPayload;
};

// Middleware helper for API routes
export async function withAuth(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Attach user to request
  (request as AuthenticatedRequest).user = user;

  return handler(request as AuthenticatedRequest);
}

// Check if user is authenticated (for use in server components)
export async function requireAuth(): Promise<JwtPayload> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}

// Check if user is authenticated (returns boolean)
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}
