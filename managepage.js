const express = require("express");
const pool = require("./db");
const authMiddleware = require("./authMiddleware");

const app = express();
app.use(express.json()); // ✅ รองรับ JSON body

// 📌 GET page (ของเดิม)
app.get("/api/page", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const rows = await conn.query(
      `SELECT p.page_id, p.page_name FROM pages AS p`
    );

    res.json({ page: rows });
  } catch (err) {
    console.error("Get page Error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของ server" });
  } finally {
    if (conn) conn.release();
  }
});

// 📌 POST insert permission ใหม่
app.post("/api/permissions/add", authMiddleware, async (req, res) => {
  const { position_id, page_id } = req.body;

  if (!position_id || !page_id) {
    return res.status(400).json({ error: "กรุณาระบุ position_id และ page_id" });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    await conn.query(
      `INSERT INTO permissions (position_id, page_id) VALUES (?, ?)`,
      [position_id, page_id]
    );

    res.json({ message: "เพิ่มสิทธิ์สำเร็จ", position_id, page_id });
  } catch (err) {
    console.error("Insert permission error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของ server" });
  } finally {
    if (conn) conn.release();
  }
});

// 📌 DELETE ลบสิทธิ์ทั้งหมดของตำแหน่ง
app.delete("/api/permissions/position/:position_id", authMiddleware, async (req, res) => {
  let conn;
  const { position_id } = req.params;

  try {
    conn = await pool.getConnection();

    // ตรวจสอบว่ามี position นี้จริงไหม
    const [check] = await conn.query(
      "SELECT position_id FROM positions WHERE position_id = ?",
      [position_id]
    );

    if (!check) {
      return res.status(404).json({ error: "ไม่พบตำแหน่งนี้" });
    }

    // ลบสิทธิ์ทั้งหมดของตำแหน่ง
    await conn.query("DELETE FROM permissions WHERE position_id = ?", [position_id]);

    res.json({ message: "ลบสิทธิ์สำเร็จ", position_id });
  } catch (err) {
    console.error("Delete permission error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของ server" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = app;
