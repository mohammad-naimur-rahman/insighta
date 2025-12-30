import { generateStructured } from "@/lib/ai";
import {
  ClaimExtractionSchema,
  buildClaimExtractionPrompt,
} from "@/lib/prompts/claim-extraction";
import { Chunk, Claim, Book } from "@/models";
import type { Types } from "mongoose";

interface ExtractClaimsOptions {
  bookId: Types.ObjectId | string;
  onProgress?: (current: number, total: number) => void;
}

export async function extractClaims({
  bookId,
  onProgress,
}: ExtractClaimsOptions): Promise<number> {
  // Get all chunks for the book
  const chunks = await Chunk.find({ bookId }).sort({ order: 1 });

  if (chunks.length === 0) {
    throw new Error("No chunks found for this book");
  }

  let totalClaimsExtracted = 0;

  // Process each chunk
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    try {
      // Build prompt and extract claims
      const prompt = buildClaimExtractionPrompt(chunk.text);
      const result = await generateStructured(ClaimExtractionSchema, prompt, {
        model: "extraction",
      });

      // Save claims to database
      if (result.claims && result.claims.length > 0) {
        const claimDocs = result.claims.map((claim) => ({
          bookId,
          chunkId: chunk._id,
          text: claim.claim,
          type: claim.type,
        }));

        await Claim.insertMany(claimDocs);
        totalClaimsExtracted += result.claims.length;
      }
    } catch (error) {
      console.error(`Error extracting claims from chunk ${i}:`, error);
      // Log the full error details for debugging
      if (error && typeof error === "object" && "responseBody" in error) {
        console.error("API Response Body:", (error as { responseBody: string }).responseBody);
      }
      // Continue with next chunk even if one fails
    }

    // Report progress
    onProgress?.(i + 1, chunks.length);
  }

  // Update book with claim count
  await Book.findByIdAndUpdate(bookId, {
    $set: { currentStep: "Claims extracted" },
  });

  return totalClaimsExtracted;
}
