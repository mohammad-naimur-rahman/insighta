import mongoose, { Schema, Model } from "mongoose";
import type { IBook, BookStatus } from "@/types";

const bookStatuses: BookStatus[] = [
  "uploaded",
  "extracting",
  "detecting_chapters",
  "compressing_chapters",
  "assembling",
  "completed",
  "failed",
];

const BookSchema = new Schema<IBook>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    author: {
      type: String,
      trim: true,
    },
    originalFilename: {
      type: String,
      required: true,
    },
    totalPages: {
      type: Number,
    },
    totalChapters: {
      type: Number,
    },
    originalWordCount: {
      type: Number,
    },
    status: {
      type: String,
      enum: bookStatuses,
      default: "uploaded",
      index: true,
    },
    currentStep: {
      type: String,
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    error: {
      type: String,
    },
    processingStartedAt: {
      type: Date,
    },
    processingCompletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for user's books sorted by creation date
BookSchema.index({ userId: 1, createdAt: -1 });

// Delete cached model in development to pick up schema changes
if (process.env.NODE_ENV !== "production" && mongoose.models.Book) {
  delete mongoose.models.Book;
}

const Book: Model<IBook> =
  mongoose.models.Book || mongoose.model<IBook>("Book", BookSchema);

export default Book;
