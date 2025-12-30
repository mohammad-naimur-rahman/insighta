import { generateStructured } from "@/lib/ai";
import {
  ClaimFilteringSchema,
  buildClaimFilteringPrompt,
} from "@/lib/prompts/claim-filtering";
import { Claim, Book } from "@/models";
import { parallelMap } from "@/lib/parallel";
import type { Types } from "mongoose";
import type { IClaim, ClaimLabel } from "@/types";

// Concurrency for parallel batch processing
const CONCURRENCY = 5;

interface FilterClaimsOptions {
  bookId: Types.ObjectId | string;
  batchSize?: number;
  onProgress?: (current: number, total: number) => void;
}

interface BatchResult {
  evaluations: {
    claimId: Types.ObjectId;
    label: ClaimLabel;
    score: number;
    reason: string;
  }[];
}

export async function filterClaims({
  bookId,
  batchSize = 20,
  onProgress,
}: FilterClaimsOptions): Promise<{ kept: number; discarded: number }> {
  // Get all unfiltered claims for the book
  const claims = await Claim.find({ bookId, label: { $exists: false } });

  if (claims.length === 0) {
    return { kept: 0, discarded: 0 };
  }

  // Split claims into batches
  const batches: IClaim[][] = [];
  for (let i = 0; i < claims.length; i += batchSize) {
    batches.push(claims.slice(i, i + batchSize));
  }

  console.log(`[Filter] Processing ${claims.length} claims in ${batches.length} batches with concurrency ${CONCURRENCY}`);
  const startTime = Date.now();

  // Process batches in parallel
  const results = await parallelMap<IClaim[], BatchResult | null>(
    batches,
    async (batch, batchIndex) => {
      try {
        const claimTexts = batch.map((c) => c.text);
        const prompt = buildClaimFilteringPrompt(claimTexts);
        const result = await generateStructured(ClaimFilteringSchema, prompt, {
          model: "filtering",
        });

        // Map evaluations back to claim IDs
        const evaluations = result.evaluations
          .map((evaluation) => {
            const claim = batch.find((c) => c.text === evaluation.claim);
            if (claim) {
              return {
                claimId: claim._id,
                label: evaluation.label as ClaimLabel,
                score: evaluation.score,
                reason: evaluation.reason,
              };
            }
            return null;
          })
          .filter((e): e is NonNullable<typeof e> => e !== null);

        return { evaluations };
      } catch (error) {
        console.error(`[Filter] Error on batch ${batchIndex}:`, error);
        return null;
      }
    },
    {
      concurrency: CONCURRENCY,
      onProgress: (completed, total) => {
        onProgress?.(completed, total);
      },
    }
  );

  // Collect all updates for bulk write
  const updates: {
    id: Types.ObjectId;
    label: ClaimLabel;
    score: number;
    reason: string;
  }[] = [];

  let keptCount = 0;
  let discardedCount = 0;

  for (const result of results) {
    if (result && !(result instanceof Error) && result.evaluations) {
      for (const evaluation of result.evaluations) {
        updates.push({
          id: evaluation.claimId,
          label: evaluation.label,
          score: evaluation.score,
          reason: evaluation.reason,
        });

        if (
          evaluation.label === "core_insight" ||
          evaluation.label === "supporting_insight"
        ) {
          keptCount++;
        } else {
          discardedCount++;
        }
      }
    }
  }

  // Bulk update all claims using updateMany with individual updates
  // Using Promise.all with batched updates for better performance
  if (updates.length > 0) {
    const updatePromises = updates.map((update) =>
      Claim.updateOne(
        { _id: update.id },
        { $set: { label: update.label, score: update.score, reason: update.reason } }
      )
    );
    await Promise.all(updatePromises);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Filter] Completed: ${keptCount} kept, ${discardedCount} discarded in ${elapsed}s`);

  // Update book status
  await Book.findByIdAndUpdate(bookId, {
    $set: { currentStep: "Claims filtered" },
  });

  return { kept: keptCount, discarded: discardedCount };
}

/**
 * Get only the core and supporting claims for further processing
 */
export async function getFilteredClaims(
  bookId: Types.ObjectId | string
): Promise<string[]> {
  const claims = await Claim.find({
    bookId,
    label: { $in: ["core_insight", "supporting_insight"] },
  }).sort({ score: -1 });

  return claims.map((c) => c.text);
}
