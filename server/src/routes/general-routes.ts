import express from "express";
import { signup, signin, verifyOtp } from "../api/landing-page/signin-signup.js";

const generalRouter = express.Router();

generalRouter.post("/signup", async (req, res) => {
    const response = await signup({ body: JSON.stringify(req.body) });
    res.status(response.statusCode).json(JSON.parse(response.body));
});

generalRouter.post("/signin", async (req, res) => {
    const response = await signin({ body: JSON.stringify(req.body) });
    res.status(response.statusCode).json(JSON.parse(response.body));
});

generalRouter.post("/verify-otp", async (req, res) => {
  const response = await verifyOtp({
    body: JSON.stringify(req.body),
    headers: req.headers
  });

  res.status(response.statusCode).json(JSON.parse(response.body));
});

export default generalRouter;