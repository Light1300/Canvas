import { MongoClient, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGO_URI || "";

const options = {
  serverApi: {
    version: ServerApiVersion.v1,
    deprecationErrors: true,
  },
  maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '10', 10),
  minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '5', 10),
  maxIdleTimeMS: parseInt(process.env.MONGODB_MAX_IDLE_TIME_MS || '60000', 10),
  connectTimeoutMS: parseInt(process.env.MONGODB_CONNECT_TIMEOUT_MS || '10000', 10),
  socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT_MS || '45000', 10),
};

let client : any = null;
let isConnecting: boolean = false;
let connectionPromise : any = null;


export const connectDB = async () => {
    try {
    // If we already have a connected client, return it
    if (client && client.topology && client.topology.isConnected()) {
      return client;
    }

    // If we're in the process of connecting, wait for that connection
    if (isConnecting) {
      return connectionPromise;
    }

    // Start a new connection
    isConnecting = true;
    connectionPromise = new Promise(async (resolve, reject) => {
      try {
        client = new MongoClient(uri, options);
        await client.connect();
        console.log("MongoDB connection pool established with config:", {
          maxPoolSize: options.maxPoolSize,
          minPoolSize: options.minPoolSize,
          maxIdleTimeMS: options.maxIdleTimeMS,
          connectTimeoutMS: options.connectTimeoutMS,
          socketTimeoutMS: options.socketTimeoutMS
        });
        isConnecting = false;
        resolve(client);
      } catch (error) {
        isConnecting = false;
        console.error("MongoDB connection error:", error);
        reject(error);
      }
    });

    return connectionPromise;
  } catch (error) {
    throw new Error(`Error in creating MongoDB client: ${error}`);
  }
};


// Graceful shutdown
const closeConnection = async () => {
  if (client) {
    try {
      await client.close();
      console.log("MongoDB connection closed");
    } catch (error) {
      console.error("Error closing MongoDB connection:", error);
    }
  }
};

// Handle application shutdown
process.on('SIGINT', async () => {
  await closeConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeConnection();
  process.exit(0);
});

module.exports = {
  connectDB,
  closeConnection
};
