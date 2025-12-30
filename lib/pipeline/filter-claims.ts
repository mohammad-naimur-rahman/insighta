import { generateStructured } from "@/lib/ai";
import {
  ClaimFilteringSchema,
  buildClaimFilteringPrompt,
} from "@/lib/prompts/claim-filtering";
import { Claim, Book } from "@/models";
import type { Types } from "mongoose";

interface FilterClaimsOptions {
  bookId: Types.ObjectId | string;
  batchSize?: number;
  onProgress?: (current: number, total: number) => void;
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

  let keptCount = 0;
  let discardedCount = 0;
  const totalBatches = Math.ceil(claims.length / batchSize);

  // Process claims in batches
  for (let i = 0; i < claims.length; i += batchSize) {
    const batch = claims.slice(i, i + batchSize);
    const claimTexts = batch.map((c) => c.text);

    try {
      // Build prompt and filter claims
      const prompt = buildClaimFilteringPrompt(claimTexts);
      const result = await generateStructured(ClaimFilteringSchema, prompt, {
        model: "filtering",
      });

      // Update claims with labels and scores
      for (const evaluation of result.evaluations) {
        const claim = batch.find((c) => c.text === evaluation.claim);
        if (claim) {
          await Claim.findByIdAndUpdate(claim._id, {
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
    } catch (error) {
      console.error(`Error filtering claims batch ${i / batchSize}:`, error);
      // Continue with next batch even if one fails
    }

    // Report progress
    const currentBatch = Math.floor(i / batchSize) + 1;
    onProgress?.(currentBatch, totalBatches);
  }

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
