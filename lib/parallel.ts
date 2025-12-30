/**
 * Parallel processing utilities for batch operations
 * Optimized for multi-core systems
 */

export interface ParallelOptions {
  /** Maximum concurrent operations (default: 5) */
  concurrency?: number;
  /** Callback for progress updates */
  onProgress?: (completed: number, total: number) => void;
  /** Whether to continue on errors (default: true) */
  continueOnError?: boolean;
}

/**
 * Process items in parallel with controlled concurrency
 * This is much faster than sequential processing while respecting API rate limits
 */
export async function parallelMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  options: ParallelOptions = {}
): Promise<(R | Error)[]> {
  const {
    concurrency = 5,
    onProgress,
    continueOnError = true,
  } = options;

  const results: (R | Error)[] = new Array(items.length);
  let completed = 0;
  let currentIndex = 0;

  async function processNext(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      const item = items[index];

      try {
        results[index] = await fn(item, index);
      } catch (error) {
        if (continueOnError) {
          results[index] = error instanceof Error ? error : new Error(String(error));
          console.error(`[Parallel] Error processing item ${index}:`, error);
        } else {
          throw error;
        }
      }

      completed++;
      onProgress?.(completed, items.length);
    }
  }

  // Start workers up to concurrency limit
  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(() => processNext());

  await Promise.all(workers);

  return results;
}

/**
 * Process items in batches with parallel batch processing
 */
export async function parallelBatch<T, R>(
  items: T[],
  batchSize: number,
  fn: (batch: T[], batchIndex: number) => Promise<R>,
  options: ParallelOptions = {}
): Promise<(R | Error)[]> {
  // Split into batches
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  return parallelMap(batches, fn, options);
}

/**
 * Filter results, removing errors
 */
export function filterErrors<T>(results: (T | Error)[]): T[] {
  return results.filter((r): r is T => !(r instanceof Error));
}

/**
 * Get successful results with their indices
 */
export function getSuccessfulResults<T>(
  results: (T | Error)[]
): { result: T; index: number }[] {
  return results
    .map((result, index) => ({ result, index }))
    .filter((item): item is { result: T; index: number } =>
      !(item.result instanceof Error)
    );
}
