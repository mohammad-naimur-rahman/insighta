import mongoose, { Schema, Model } from "mongoose";
import bcrypt from "bcryptjs";
import type { IUser } from "@/types";

interface IUserMethods {
  comparePassword(password: string): Promise<boolean>;
}

type UserModel = Model<IUser, object, IUserMethods>;

const UserSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    googleId: {
      type: String,
      sparse: true, // Allow null but unique when present
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      // Required only for email auth, not for Google auth
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
UserSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
UserSchema.methods.comparePassword = async function (
  password: string
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(password, this.password);
};

const User: UserModel =
  mongoose.models.User || mongoose.model<IUser, UserModel>("User", UserSchema);

export default User;
