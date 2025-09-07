const express = require("express");
const pool = require("./db");
const authMiddleware = require("./authMiddleware");

const app = express();
app.use(express.json());

app.post("/api/chemicals/add", authMiddleware, async (req, res) => {
  const { chemical_name, chemical_type, quantity, received_date, expiry_date, company_name, price } = req.body;

  let conn;
  try {
    conn = await pool.getConnection();

    if (!chemical_type || chemical_type.length === 0) {
      return res.status(400).json({ error: "กรุณาระบุประเภทสารเคมี" });
    }

    // ✅ หา type_id จาก chemical_types
    const typeRow = await conn.query(
      "SELECT type_id FROM chemical_types WHERE type_name = ? LIMIT 1",
      [chemical_type]
    );

    if (typeRow.length === 0) {
      return res.status(400).json({ error: "ไม่พบประเภทสารเคมีในระบบ" });
    }

    const typeId = typeRow[0].type_id;

    // ✅ gen prefix = "ch" + typeId
    const prefix = "ch" + typeId;

    // หา running ล่าสุด
    const maxIdRow = await conn.query(
      "SELECT chemical_id FROM chemicals WHERE chemical_id LIKE ? ORDER BY chemical_id DESC LIMIT 1",
      [prefix + "%"]
    );

    let runNo = 1;
    if (maxIdRow.length > 0) {
      const lastId = maxIdRow[0].chemical_id;
      runNo = parseInt(lastId.slice(prefix.length)) + 1;
    }

    const newId = prefix + runNo.toString().padStart(6, "0");

    // insert
    await conn.query(
      `INSERT INTO chemicals
       (chemical_id, chemical_name, chemical_type, quantity, received_date, expiry_date, company_name, price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId, chemical_name, chemical_type, quantity, received_date, expiry_date, company_name, price]
    );

    res.json({ message: "เพิ่มสารเคมีสำเร็จ", chemical_id: newId });
  } catch (err) {
    console.error("Add Chemical Error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    if (conn) conn.release();
  }
});

// ✅ ดึงสารเคมีทั้งหมด
app.get("/api/chemicals/all", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const rows = await conn.query(
      `SELECT 
          c.chemical_name,c.chemical_id,
          c.chemical_type,
          c.quantity,
           DATE_FORMAT(c.expiry_date, '%d-%b-%Y') AS expiry_date
       FROM chemicals c
       ORDER BY c.chemical_id ASC`
    );

    res.json({ chemicals: rows });
  } catch (err) {
    console.error("Get Chemicals Error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = app;