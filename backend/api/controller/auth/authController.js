import pool from "../../../config/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function register(req, res) {
  try {
    const { email, password } = registerSchema.parse(req.body);
    const existing = await pool.query(`SELECT id FROM users WHERE email=$1`, [
      email,
    ]);
    if (existing.rowCount > 0) {
      return res
        .status(409)
        .json({ ok: false, message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users(email, password_hash)
       VALUES($1, $2)
       RETURNING id, email, created_at`,
      [email, passwordHash],
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );
    console.log(`Registering user with ${email}`);

    return res.status(201).json({
      ok: true,
      message: "Registered successfully",
      token,
      user,
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const result = await pool.query(
      `SELECT id, email, password_hash, created_at FROM users WHERE email=$1`,
      [email],
    );

    if (result.rowCount === 0) {
      return res
        .status(401)
        .json({ ok: false, message: "Invalid credentials" });
    }

    const user = result.rows[0];

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res
        .status(401)
        .json({ ok: false, message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    return res.status(200).json({
      ok: true,
      message: "Login success",
      token,
      user: { id: user.id, email: user.email, created_at: user.created_at },
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
}
