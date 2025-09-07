const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const cors = require("cors");
const pool = require("./db");

const app = express();
app.use(cors({
  origin: "*",     
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(bodyParser.json());
const JWT_SECRET = "my_secret_key";

app.post("/api/login", async (req, res) => {
  const { user, password } = req.body;

  if (!user || !password) {
    return res.status(400).json({ error: "กรุณากรอก user และ password" });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    const rows = await conn.query(
      `SELECT id, first_name, last_name, phone, email, password_hash, employment_status 
       FROM employees 
       WHERE phone = ? OR email = ? 
       LIMIT 1`,
      [user, user]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "ไม่พบผู้ใช้งาน" });
    }

    const emp = rows[0];

    if (emp.employment_status !== "ACTIVE") {
      return res.status(403).json({ error: "บัญชีนี้ถูกระงับการใช้งาน" });
    }

    const match = await bcrypt.compare(password, emp.password_hash);
    if (!match) {
      return res.status(401).json({ error: "รหัสผ่านไม่ถูกต้อง" });
    }

    const token = jwt.sign(
      { id: emp.id, phone: emp.phone, email: emp.email },
      JWT_SECRET,
      { expiresIn: "30m" }   
    );

    await conn.query("UPDATE employees SET token = ? WHERE id = ?", [token, emp.id]);

    res.json({
      message: "เข้าสู่ระบบสำเร็จ",
      token,
      user: {
        id: emp.id,
        first_name: emp.first_name,
        last_name: emp.last_name,
        phone: emp.phone,
        email: emp.email
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของ server" });
  } finally {
    if (conn) conn.release();
  }
});


module.exports = app;
