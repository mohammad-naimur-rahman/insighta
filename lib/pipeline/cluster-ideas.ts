import { generateStructured } from "@/lib/ai";
import {
  IdeaClusteringSchema,
  buildIdeaClusteringPrompt,
} from "@/lib/prompts/idea-clustering";
import {
  IdeaExpansionSchema,
  buildIdeaExpansionPrompt,
} from "@/lib/prompts/idea-expansion";
import { Idea, Book } from "@/models";
import { parallelMap } from "@/lib/parallel";
import type { Types } from "mongoose";

// Concurrency for parallel idea expansion
const CONCURRENCY = 5;

interface ClusterIdeasOptions {
  bookId: Types.ObjectId | string;
  filteredClaims: string[];
  onProgress?: (step: string, current: number, total: number) => void;
}

interface ClusteredIdea {
  idea_title: string;
  merged_claims: string[];
  summary: string;
}

interface ExpandedIdea {
  idea: ClusteredIdea;
  principle: string;
  behaviorDelta: string;
  order: number;
}

export async function clusterIdeas({
  bookId,
  filteredClaims,
  onProgress,
}: ClusterIdeasOptions): Promise<number> {
  if (filteredClaims.length === 0) {
    throw new Error("No filtered claims to cluster");
  }

  console.log(`[Cluster] Starting with ${filteredClaims.length} claims`);
  const startTime = Date.now();

  // Step 1: Cluster claims into ideas
  onProgress?.("Clustering claims", 1, 3);

  const prompt = buildIdeaClusteringPrompt(filteredClaims);
  const clusterResult = await generateStructured(IdeaClusteringSchema, prompt, {
    model: "reasoning",
  });

  if (!clusterResult.ideas || clusterResult.ideas.length === 0) {
    throw new Error("No ideas generated from clustering");
  }

  console.log(`[Cluster] Generated ${clusterResult.ideas.length} idea clusters`);

  // Step 2: Generate principles and behavior deltas in parallel (combined prompt)
  onProgress?.("Expanding ideas", 2, 3);

  const expandedIdeas = await parallelMap<ClusteredIdea, ExpandedIdea | null>(
    clusterResult.ideas,
    async (idea, index) => {
      try {
        const expansionPrompt = buildIdeaExpansionPrompt(
          idea.idea_title,
          idea.merged_claims
        );
        const expansion = await generateStructured(IdeaExpansionSchema, expansionPrompt, {
          model: "reasoning",
        });

        return {
          idea,
          principle: expansion.principle,
          behaviorDelta: expansion.behavior_delta,
          order: index,
        };
      } catch (error) {
        console.error(`[Cluster] Error expanding idea ${index}:`, error);
        return null;
      }
    },
    {
      concurrency: CONCURRENCY,
    }
  );

  // Step 3: Save ideas to database
  onProgress?.("Saving ideas", 3, 3);

  // Delete any existing ideas for this book
  await Idea.deleteMany({ bookId });

  // Create new ideas from successful expansions
  const successfulExpansions = expandedIdeas.filter(
    (result): result is ExpandedIdea => result !== null && !(result instanceof Error)
  );

  const ideaDocs = successfulExpansions.map((result) => ({
    bookId,
    title: result.idea.idea_title,
    mergedClaims: result.idea.merged_claims,
    principle: result.principle,
    behaviorDelta: result.behaviorDelta,
    examples: [] as string[],
    order: result.order,
  }));

  if (ideaDocs.length > 0) {
    await Idea.insertMany(ideaDocs);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Cluster] Completed: ${ideaDocs.length} ideas in ${elapsed}s`);

  // Update book status
  await Book.findByIdAndUpdate(bookId, {
    $set: { currentStep: "Ideas clustered" },
  });

  return ideaDocs.length;
}
