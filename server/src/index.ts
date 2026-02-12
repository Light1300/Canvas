import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./utils/mongodb/mongo-client.js";
import generalRouter  from "./routes/general-routes.js";


dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;


app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use("/api/home", generalRouter);




app.listen(PORT, async () => {
    try {
        console.log(`Server is running on port ${PORT}`);
    } catch (error) {
       console.log("Error starting server:", error);
        process.exit(1); 
    }
});
