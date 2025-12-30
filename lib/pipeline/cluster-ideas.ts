import { generateStructured, generateResponse } from "@/lib/ai";
import {
  IdeaClusteringSchema,
  buildIdeaClusteringPrompt,
} from "@/lib/prompts/idea-clustering";
import { buildPrincipleRewritePrompt } from "@/lib/prompts/principle-rewrite";
import { buildBehaviorDeltaPrompt } from "@/lib/prompts/behavior-delta";
import { Idea, Book } from "@/models";
import type { Types } from "mongoose";

interface ClusterIdeasOptions {
  bookId: Types.ObjectId | string;
  filteredClaims: string[];
  onProgress?: (step: string, current: number, total: number) => void;
}

export async function clusterIdeas({
  bookId,
  filteredClaims,
  onProgress,
}: ClusterIdeasOptions): Promise<number> {
  if (filteredClaims.length === 0) {
    throw new Error("No filtered claims to cluster");
  }

  // Step 1: Cluster claims into ideas
  onProgress?.("Clustering claims", 1, 4);

  const prompt = buildIdeaClusteringPrompt(filteredClaims);
  const clusterResult = await generateStructured(IdeaClusteringSchema, prompt, {
    model: "reasoning",
  });

  if (!clusterResult.ideas || clusterResult.ideas.length === 0) {
    throw new Error("No ideas generated from clustering");
  }

  // Step 2: Generate principles for each idea
  onProgress?.("Generating principles", 2, 4);

  const ideasWithPrinciples = await Promise.all(
    clusterResult.ideas.map(async (idea, index) => {
      const principlePrompt = buildPrincipleRewritePrompt(
        idea.idea_title,
        idea.merged_claims
      );
      const principle = await generateResponse(principlePrompt, {
        model: "reasoning",
      });

      return {
        ...idea,
        principle,
        order: index,
      };
    })
  );

  // Step 3: Generate behavior deltas
  onProgress?.("Generating behavior deltas", 3, 4);

  const ideasWithDeltas = await Promise.all(
    ideasWithPrinciples.map(async (idea) => {
      const deltaPrompt = buildBehaviorDeltaPrompt(
        idea.idea_title,
        idea.principle
      );
      const behaviorDelta = await generateResponse(deltaPrompt, {
        model: "reasoning",
      });

      return {
        ...idea,
        behaviorDelta,
      };
    })
  );

  // Step 4: Save ideas to database
  onProgress?.("Saving ideas", 4, 4);

  // Delete any existing ideas for this book
  await Idea.deleteMany({ bookId });

  // Create new ideas
  const ideaDocs = ideasWithDeltas.map((idea) => ({
    bookId,
    title: idea.idea_title,
    mergedClaims: idea.merged_claims,
    principle: idea.principle,
    behaviorDelta: idea.behaviorDelta,
    examples: [], // Will be populated separately if needed
    order: idea.order,
  }));

  await Idea.insertMany(ideaDocs);

  // Update book status
  await Book.findByIdAndUpdate(bookId, {
    $set: { currentStep: "Ideas clustered" },
  });

  return ideaDocs.length;
}
