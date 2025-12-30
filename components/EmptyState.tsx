"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { IconBook, IconUpload } from "@tabler/icons-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: {
    label: string;
    href: string;
  };
}

export function EmptyState({
  title = "No books yet",
  description = "Upload your first book to start extracting insights.",
  action = { label: "Upload Book", href: "/upload" },
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <IconBook className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-sm mb-6">{description}</p>
      <Button asChild>
        <Link href={action.href}>
          <IconUpload className="mr-2 h-4 w-4" />
          {action.label}
        </Link>
      </Button>
    </div>
  );
}
