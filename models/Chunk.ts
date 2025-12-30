import mongoose, { Schema, Model } from "mongoose";
import type { IChunk } from "@/types";

const ChunkSchema = new Schema<IChunk>(
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
    text: {
      type: String,
      required: true,
    },
    pageStart: {
      type: Number,
    },
    pageEnd: {
      type: Number,
    },
    tokenCount: {
      type: Number,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound index for fetching chunks in order
ChunkSchema.index({ bookId: 1, order: 1 });

const Chunk: Model<IChunk> =
  mongoose.models.Chunk || mongoose.model<IChunk>("Chunk", ChunkSchema);

export default Chunk;
