"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IconBrandGoogle, IconLoader } from "@tabler/icons-react";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessages: Record<string, string> = {
    no_code: "Authentication was cancelled or failed.",
    auth_failed: "Failed to authenticate with Google. Please try again.",
    access_denied: "Access was denied. Please try again.",
  };

  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Insighta</CardTitle>
        <CardDescription>
          Signal-first book distillation. Extract only the ideas that matter.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {errorMessages[error] || "An error occurred. Please try again."}
          </div>
        )}

        <Button
          onClick={handleGoogleLogin}
          variant="outline"
          className="w-full"
          size="lg"
        >
          <IconBrandGoogle className="mr-2 h-5 w-5" />
          Continue with Google
        </Button>

        <p className="text-xs text-center text-muted-foreground pt-4">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </CardContent>
    </Card>
  );
}

function LoginFallback() {
  return (
    <Card className="w-full max-w-md">
      <CardContent className="flex items-center justify-center py-12">
        <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Suspense fallback={<LoginFallback />}>
        <LoginContent />
      </Suspense>
    </div>
  );
}
