"use client";

import { useEffect, useState } from "react";
import { IconClock } from "@tabler/icons-react";

interface ProcessingTimerProps {
  startedAt?: string;
  completedAt?: string;
  isProcessing: boolean;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export function ProcessingTimer({
  startedAt,
  completedAt,
  isProcessing,
}: ProcessingTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }

    const startTime = new Date(startedAt).getTime();

    // If completed, calculate final duration
    if (completedAt) {
      const endTime = new Date(completedAt).getTime();
      setElapsed(Math.floor((endTime - startTime) / 1000));
      return;
    }

    // If still processing, update every second
    if (isProcessing) {
      // Calculate initial elapsed time (handles page refresh)
      const now = Date.now();
      setElapsed(Math.floor((now - startTime) / 1000));

      const interval = setInterval(() => {
        const now = Date.now();
        setElapsed(Math.floor((now - startTime) / 1000));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [startedAt, completedAt, isProcessing]);

  // Show nothing if never processed
  if (!startedAt && !isProcessing) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <IconClock className="h-4 w-4" />
        <span>--:--</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <IconClock className="h-4 w-4 text-muted-foreground" />
      <span className={completedAt ? "text-muted-foreground" : "text-primary font-medium"}>
        {formatDuration(elapsed)}
      </span>
      {completedAt && (
        <span className="text-muted-foreground">total</span>
      )}
    </div>
  );
}
