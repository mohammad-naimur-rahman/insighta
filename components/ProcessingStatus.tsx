"use client";

import { cn } from "@/lib/utils";
import type { BookStatus } from "@/types";
import {
  IconCheck,
  IconLoader,
  IconCircle,
  IconAlertCircle,
} from "@tabler/icons-react";

interface ProcessingStep {
  id: BookStatus;
  label: string;
}

const processingSteps: ProcessingStep[] = [
  { id: "uploaded", label: "Book uploaded" },
  { id: "extracting", label: "Extracting text from PDF" },
  { id: "chunking", label: "Splitting into chunks" },
  { id: "extracting_claims", label: "Extracting claims" },
  { id: "filtering_claims", label: "Filtering & scoring claims" },
  { id: "selecting_examples", label: "Selecting examples" },
  { id: "clustering_ideas", label: "Clustering ideas" },
  { id: "rewriting_principles", label: "Rewriting principles" },
  { id: "generating_deltas", label: "Generating behavior deltas" },
  { id: "reconstructing", label: "Reconstructing book" },
  { id: "quality_check", label: "Quality check" },
  { id: "completed", label: "Completed" },
];

interface ProcessingStatusProps {
  currentStatus: BookStatus;
  progress?: number;
  error?: string;
}

export function ProcessingStatus({
  currentStatus,
  progress,
  error,
}: ProcessingStatusProps) {
  const currentIndex = processingSteps.findIndex(
    (step) => step.id === currentStatus
  );
  const isFailed = currentStatus === "failed";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {processingSteps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex && !isFailed;
          const isPending = index > currentIndex;

          return (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-3 py-2 px-3 rounded-md transition-colors",
                isCurrent && "bg-primary/10",
                isCompleted && "opacity-70"
              )}
            >
              {/* Status icon */}
              <div className="flex-shrink-0">
                {isCompleted || (isCurrent && currentStatus === "completed") ? (
                  <IconCheck className="h-5 w-5 text-green-500" />
                ) : isCurrent ? (
                  <IconLoader className="h-5 w-5 text-primary animate-spin" />
                ) : isFailed && index === currentIndex ? (
                  <IconAlertCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <IconCircle className="h-5 w-5 text-muted-foreground/40" />
                )}
              </div>

              {/* Step label */}
              <span
                className={cn(
                  "text-sm",
                  isCurrent && currentStatus !== "completed" && "font-medium text-primary",
                  isCurrent && currentStatus === "completed" && "font-medium text-green-600",
                  isCompleted && "text-muted-foreground",
                  isPending && "text-muted-foreground/60"
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      {progress !== undefined && !isFailed && currentStatus !== "completed" && (
        <div className="pt-4">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Overall progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {isFailed && error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}
