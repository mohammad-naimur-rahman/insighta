import mongoose, { Schema, Model } from "mongoose";
import type { IClaim, ClaimType, ClaimLabel } from "@/types";

const claimTypes: ClaimType[] = [
  "principle",
  "rule",
  "recommendation",
  "constraint",
  "causal",
];

const claimLabels: ClaimLabel[] = [
  "core_insight",
  "supporting_insight",
  "redundant",
  "filler",
];

const ClaimSchema = new Schema<IClaim>(
  {
    bookId: {
      type: Schema.Types.ObjectId,
      ref: "Book",
      required: true,
      index: true,
    },
    chunkId: {
      type: Schema.Types.ObjectId,
      ref: "Chunk",
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: claimTypes,
      required: true,
    },
    label: {
      type: String,
      enum: claimLabels,
    },
    score: {
      type: Number,
      min: 0,
      max: 1,
    },
    reason: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound index for fetching claims by book
ClaimSchema.index({ bookId: 1, label: 1 });

const Claim: Model<IClaim> =
  mongoose.models.Claim || mongoose.model<IClaim>("Claim", ClaimSchema);

export default Claim;
