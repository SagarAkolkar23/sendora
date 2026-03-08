import express from "express";
import dotenv from "dotenv"
import cors from "cors";
import pool from "../backend/config/db.js";


dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());


app.get("/", async (req, res) => {
  res.send("Server started");
});

app.get("/health/db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() as now");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 5005;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server started at http://localhost:${PORT}`);
});
