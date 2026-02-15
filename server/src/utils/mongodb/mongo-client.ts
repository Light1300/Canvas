import { MongoClient, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGO_URI || "";

const options = {
  serverApi: {
    version: ServerApiVersion.v1,
    deprecationErrors: true,
  },
  maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || "10", 10),
  minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || "5", 10),
};

let client: MongoClient | null = null;
let connectionPromise: Promise<MongoClient> | null = null;
let isIndexed = false;

export const connectDB = async (): Promise<MongoClient> => {
  if (client) return client;
  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    const newClient = new MongoClient(uri, options);
    await newClient.connect();

    console.log("MongoDB connected");

    const db = newClient.db();

    if (!isIndexed) {
      await db.collection("users").createIndex(
        { email: 1 },
        { unique: true }
      );
      isIndexed = true;
    }

    client = newClient;
    return newClient;
  })();

  return connectionPromise;
};