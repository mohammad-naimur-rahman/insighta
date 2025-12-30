import { Types } from "mongoose";

// Book processing status
export type BookStatus =
  | "uploaded"
  | "extracting"
  | "detecting_chapters"
  | "compressing_chapters"
  | "assembling"
  | "completed"
  | "failed";

// Claim labels from the filtering step
export type ClaimLabel = "core_insight" | "supporting_insight" | "redundant" | "filler";

// Claim types from extraction
export type ClaimType = "principle" | "rule" | "recommendation" | "constraint" | "causal";

// User type
export interface IUser {
  _id: Types.ObjectId;
  googleId?: string;
  email: string;
  password?: string;
  name: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Book type
export interface IBook {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  author?: string;
  originalFilename: string;
  totalPages?: number;
  totalChapters?: number;
  originalWordCount?: number;
  status: BookStatus;
  currentStep?: string;
  progress?: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Chapter type
export interface IChapter {
  _id: Types.ObjectId;
  bookId: Types.ObjectId;
  order: number;
  title: string;
  level: number; // 1 = chapter, 2 = section, 3 = subsection
  originalContent: string;
  compressedContent?: string;
  keyInsights?: string[];
  originalTokenCount: number;
  compressedTokenCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Chunk type
export interface IChunk {
  _id: Types.ObjectId;
  bookId: Types.ObjectId;
  order: number;
  text: string;
  pageStart?: number;
  pageEnd?: number;
  tokenCount?: number;
  createdAt: Date;
}

// Claim type
export interface IClaim {
  _id: Types.ObjectId;
  bookId: Types.ObjectId;
  chunkId: Types.ObjectId;
  text: string;
  type: ClaimType;
  label?: ClaimLabel;
  score?: number;
  reason?: string;
  createdAt: Date;
}

// Example type (embedded in Idea)
export interface IExample {
  text: string;
  reasonKept: "clarifies_application" | "removes_ambiguity";
}

// Idea type
export interface IIdea {
  _id: Types.ObjectId;
  bookId: Types.ObjectId;
  title: string;
  mergedClaims: string[];
  principle?: string;
  examples: IExample[];
  behaviorDelta?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// Final output type
export interface IFinalOutput {
  _id: Types.ObjectId;
  bookId: Types.ObjectId;
  markdown: string;
  wordCount: number;
  ideaCount: number;
  compressionRatio?: number;
  createdAt: Date;
  updatedAt: Date;
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Auth types
export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

// Processing step info
export interface ProcessingStep {
  name: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  progress?: number;
  message?: string;
}
