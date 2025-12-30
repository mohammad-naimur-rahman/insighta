import mongoose, { Schema, Model } from "mongoose";
import type { IIdea, IExample } from "@/types";

const ExampleSchema = new Schema<IExample>(
  {
    text: {
      type: String,
      required: true,
    },
    reasonKept: {
      type: String,
      enum: ["clarifies_application", "removes_ambiguity"],
      required: true,
    },
  },
  { _id: false }
);

const IdeaSchema = new Schema<IIdea>(
  {
    bookId: {
      type: Schema.Types.ObjectId,
      ref: "Book",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    mergedClaims: {
      type: [String],
      default: [],
    },
    principle: {
      type: String,
    },
    examples: {
      type: [ExampleSchema],
      default: [],
    },
    behaviorDelta: {
      type: String,
    },
    order: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fetching ideas in order
IdeaSchema.index({ bookId: 1, order: 1 });

const Idea: Model<IIdea> =
  mongoose.models.Idea || mongoose.model<IIdea>("Idea", IdeaSchema);

export default Idea;
