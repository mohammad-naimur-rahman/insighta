import { generateStructured } from "@/lib/ai";
import {
  ClaimExtractionSchema,
  buildClaimExtractionPrompt,
} from "@/lib/prompts/claim-extraction";
import { Chunk, Claim, Book } from "@/models";
import { parallelMap } from "@/lib/parallel";
import type { Types } from "mongoose";
import type { IChunk } from "@/types";

// Concurrency limit for API calls (adjust based on rate limits)
const CONCURRENCY = 5;

interface ExtractClaimsOptions {
  bookId: Types.ObjectId | string;
  onProgress?: (current: number, total: number) => void;
}

interface ChunkResult {
  chunkId: Types.ObjectId;
  claims: { claim: string; type: string }[];
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

  console.log(`[Extract] Processing ${chunks.length} chunks with concurrency ${CONCURRENCY}`);
  const startTime = Date.now();

  // Process chunks in parallel
  const results = await parallelMap<IChunk, ChunkResult | null>(
    chunks,
    async (chunk, index) => {
      try {
        const prompt = buildClaimExtractionPrompt(chunk.text);
        const result = await generateStructured(ClaimExtractionSchema, prompt, {
          model: "extraction",
        });

        if (result.claims && result.claims.length > 0) {
          return {
            chunkId: chunk._id,
            claims: result.claims,
          };
        }
        return null;
      } catch (error) {
        console.error(`[Extract] Error on chunk ${index}:`, error);
        return null;
      }
    },
    {
      concurrency: CONCURRENCY,
      onProgress,
    }
  );

  // Collect all claims for bulk insert
  const allClaimDocs: {
    bookId: Types.ObjectId | string;
    chunkId: Types.ObjectId;
    text: string;
    type: string;
  }[] = [];

  for (const result of results) {
    if (result && !(result instanceof Error) && result.claims) {
      for (const claim of result.claims) {
        allClaimDocs.push({
          bookId,
          chunkId: result.chunkId,
          text: claim.claim,
          type: claim.type,
        });
      }
    }
  }

  // Bulk insert all claims at once
  if (allClaimDocs.length > 0) {
    await Claim.insertMany(allClaimDocs);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Extract] Completed: ${allClaimDocs.length} claims in ${elapsed}s`);

  // Update book with claim count
  await Book.findByIdAndUpdate(bookId, {
    $set: { currentStep: "Claims extracted" },
  });

  return allClaimDocs.length;
}
