import "dotenv/config";
import express from "express";
import cors from "cors";
import apiRoutes from "./routes/api.js";
import juspayRoutes from "./routes/juspay.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API routes
app.use("/api", apiRoutes);
app.use("/api/juspay", juspayRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Merchant: ${process.env.MERCHANT_NAME} (${process.env.MERCHANT_ID})`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});
