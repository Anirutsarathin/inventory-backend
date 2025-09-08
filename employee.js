const express = require("express");
const pool = require("./db");
const authMiddleware = require("./authMiddleware");

const app = express();


app.get("/api/employees", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const rows = await conn.query(
    `   SELECT 
            CONCAT(e.first_name,' ',e.last_name) as name,
            p.position_name as position,
            case
                when e.status = 1 then 'ACTIVE'
                when e.status = 0 then 'INACTIVE'
            end as status
        FROM employees e
        inner join positions p on e.position_id = p.position_id;`
    );

    res.json({ employees: rows });
  } catch (err) {
    console.error("Get Employees Error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของ server" });
  } finally {
    if (conn) conn.release();
  }
});
app.get("/api/employees/position", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const rows = await conn.query(
    `   SELECT 
            p.position_id as id ,p.position_name as name
        FROM positions p
    `
    );

    res.json({ employees: rows });
  } catch (err) {
    console.error("Get Employees position Error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของ server" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = app;
