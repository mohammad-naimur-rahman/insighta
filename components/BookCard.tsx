"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BookStatus } from "@/types";
import {
  IconBook,
  IconLoader,
  IconCheck,
  IconAlertCircle,
} from "@tabler/icons-react";

interface BookCardProps {
  id: string;
  title: string;
  author?: string;
  status: BookStatus;
  progress?: number;
  createdAt: string;
}

const statusConfig: Record<
  BookStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  uploaded: { label: "Uploaded", variant: "secondary" },
  extracting: { label: "Extracting text", variant: "default" },
  detecting_chapters: { label: "Detecting chapters", variant: "default" },
  compressing_chapters: { label: "Compressing", variant: "default" },
  assembling: { label: "Assembling", variant: "default" },
  completed: { label: "Completed", variant: "outline" },
  failed: { label: "Failed", variant: "destructive" },
};

function StatusIcon({ status }: { status: BookStatus }) {
  if (status === "completed") {
    return <IconCheck className="h-4 w-4 text-green-500" />;
  }
  if (status === "failed") {
    return <IconAlertCircle className="h-4 w-4 text-destructive" />;
  }
  if (status === "uploaded") {
    return <IconBook className="h-4 w-4 text-muted-foreground" />;
  }
  return <IconLoader className="h-4 w-4 animate-spin text-primary" />;
}

export function BookCard({
  id,
  title,
  author,
  status,
  progress,
  createdAt,
}: BookCardProps) {
  const config = statusConfig[status];
  const isProcessing = ![
    "uploaded",
    "completed",
    "failed",
  ].includes(status);

  return (
    <Link href={`/book/${id}`}>
      <Card className="transition-all hover:shadow-md hover:border-primary/50 cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg line-clamp-2">{title}</CardTitle>
              {author && (
                <CardDescription className="truncate">{author}</CardDescription>
              )}
            </div>
            <StatusIcon status={status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Badge variant={config.variant}>{config.label}</Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(createdAt).toLocaleDateString()}
            </span>
          </div>

          {isProcessing && progress !== undefined && (
            <div className="mt-3">
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {progress}% complete
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
