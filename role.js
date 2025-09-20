const express = require("express");
const pool = require("./db");
const authMiddleware = require("./authMiddleware");

const app = express();

app.get("/api/role", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const rows = await conn.query(
      `SELECT DISTINCT 
          po.position_id,
          po.position_name,
          pa.page_name
       FROM permissions pe
       JOIN positions po ON pe.position_id = po.position_id
       JOIN pages pa ON pe.page_id = pa.page_id
       ORDER BY po.position_name, pa.page_name`
    );

    res.json({ roles: rows });
  } catch (err) {
    console.error("Get Roles Error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = app;