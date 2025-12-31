import mongoose, { Schema, Model } from "mongoose";
import type { IChapter } from "@/types";

const ChapterSchema = new Schema<IChapter>(
  {
    bookId: {
      type: Schema.Types.ObjectId,
      ref: "Book",
      required: true,
      index: true,
    },
    order: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    level: {
      type: Number,
      required: true,
      default: 1,
    },
    originalContent: {
      type: String,
      required: true,
    },
    compressedContent: {
      type: String,
    },
    keyInsights: {
      type: [String],
      default: [],
    },
    originalTokenCount: {
      type: Number,
      required: true,
    },
    compressedTokenCount: {
      type: Number,
    },
    // New fields for context-aware compression
    previousContext: {
      type: String,
    },
    chapterSummary: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fetching chapters in order
ChapterSchema.index({ bookId: 1, order: 1 });

const Chapter: Model<IChapter> =
  mongoose.models.Chapter || mongoose.model<IChapter>("Chapter", ChapterSchema);

export default Chapter;
