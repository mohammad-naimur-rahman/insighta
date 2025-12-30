import mongoose, { Schema, Model } from "mongoose";
import type { IFinalOutput } from "@/types";

const FinalOutputSchema = new Schema<IFinalOutput>(
  {
    bookId: {
      type: Schema.Types.ObjectId,
      ref: "Book",
      required: true,
      unique: true,
      index: true,
    },
    markdown: {
      type: String,
      required: true,
    },
    wordCount: {
      type: Number,
      required: true,
    },
    ideaCount: {
      type: Number,
      required: true,
    },
    compressionRatio: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

const FinalOutput: Model<IFinalOutput> =
  mongoose.models.FinalOutput ||
  mongoose.model<IFinalOutput>("FinalOutput", FinalOutputSchema);

export default FinalOutput;
