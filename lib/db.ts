import mongoose from "mongoose";
import dns from "dns";

// Force Node.js to use Google DNS for resolution (fixes SRV lookup issues on Windows)
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const MONGODB_URI = process.env.MONGODB_URI;

async function connectDB() {
  if (!MONGODB_URI) {
    throw new Error("Please define the MONGODB_URI environment variable");
  }

  // Check if already connected
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  // Check if connecting
  if (mongoose.connection.readyState === 2) {
    // Wait for connection to complete
    await new Promise<void>((resolve) => {
      mongoose.connection.once("connected", resolve);
    });
    return mongoose;
  }

  console.log("[DB] Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("[DB] Connected to MongoDB successfully");

  return mongoose;
}

export { connectDB };
export default connectDB;
