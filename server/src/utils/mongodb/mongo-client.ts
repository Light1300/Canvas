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
  maxIdleTimeMS: parseInt(process.env.MONGODB_MAX_IDLE_TIME_MS || "60000", 10),
  connectTimeoutMS: parseInt(process.env.MONGODB_CONNECT_TIMEOUT_MS || "10000", 10),
  socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT_MS || "45000", 10),
};

let client: MongoClient | null = null;
let connectionPromise: Promise<MongoClient> | null = null;

export const connectDB = async (): Promise<MongoClient> => {
  try {
    // If client already exists, reuse it
    if (client) {
      return client;
    }

    // If connection is already in progress, wait for it
    if (connectionPromise) {
      return connectionPromise;
    }

    // Create new connection
    connectionPromise = new Promise(async (resolve, reject) => {
      try {
        const newClient = new MongoClient(uri, options);
        await newClient.connect();

        console.log("MongoDB connected with pool config:", {
          maxPoolSize: options.maxPoolSize,
          minPoolSize: options.minPoolSize,
        });

        client = newClient;
        resolve(newClient);
      } catch (error) {
        console.error("MongoDB connection error:", error);
        reject(error);
      }
    });

    return connectionPromise;
  } catch (error) {
    throw new Error(`Error creating MongoDB client: ${error}`);
  }
};

// Graceful shutdown
export const closeConnection = async (): Promise<void> => {
  if (client) {
    try {
      await client.close();
      console.log("MongoDB connection closed");
      client = null;
      connectionPromise = null;
    } catch (error) {
      console.error("Error closing MongoDB connection:", error);
    }
  }
};

// Handle shutdown
process.on("SIGINT", async () => {
  await closeConnection();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeConnection();
  process.exit(0);
});