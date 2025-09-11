const express = require("express");
const pool = require("./db");
const authMiddleware = require("./authMiddleware");

const app = express();
app.use(express.json()); // ✅ เพื่อให้รับ JSON body ได้

// ----------------------
// GET employees
// ----------------------
app.get("/api/employees", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const rows = await conn.query(
      `
      SELECT 
        e.employee_id,
        e.first_name,
        e.last_name,
        CONCAT(e.first_name,' ',e.last_name) as name,
        p.position_id,
        p.position_name as position,
        e.phone,
        e.status,
        case 
          when e.status = 0 then 'INACTIVE'
          else 'ACTIVE'
        end as status_label
      FROM employees e
      INNER JOIN positions p ON e.position_id = p.position_id;
     `
    );

    res.json({ employees: rows });
  } catch (err) {
    console.error("Get Employees Error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของ server" });
  } finally {
    if (conn) conn.release();
  }
});

// ----------------------
// GET positions
// ----------------------
app.get("/api/employees/position", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const rows = await conn.query(
      `SELECT 
          p.position_id as id,
          p.position_name as name
       FROM positions p`
    );

    res.json({ employees: rows });
  } catch (err) {
    console.error("Get Employees position Error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของ server" });
  } finally {
    if (conn) conn.release();
  }
});

// ----------------------
// PUT update employee
// ----------------------
app.put("/api/employees/:id", authMiddleware, async (req, res) => {
  let conn;
  const { id } = req.params;
  const { first_name, last_name, position_id, phone, status } = req.body;

  try {
    conn = await pool.getConnection();

    // ✅ ตรวจสอบว่ามี employee จริงไหม
    const check = await conn.query(
      "SELECT employee_id FROM employees WHERE employee_id = ?",
      [id]
    );
    if (check.length === 0) {
      return res.status(404).json({ error: "ไม่พบพนักงานที่ต้องการแก้ไข" });
    }

    // ✅ update
    await conn.query(
      `UPDATE employees
       SET first_name = ?,
           last_name = ?,
           position_id = ?,
           phone = ?,
           status = ?
       WHERE employee_id = ?`,
      [first_name, last_name, position_id, phone, status, id]
    );

    res.json({ message: "แก้ไขข้อมูลพนักงานเรียบร้อยแล้ว" });
  } catch (err) {
    console.error("Update Employee Error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของ server" });
  } finally {
    if (conn) conn.release();
  }
});
// ----------------------
// DELETE employee
// ----------------------
app.delete("/api/employees/:id", authMiddleware, async (req, res) => {
  let conn;
  const { id } = req.params;

  try {
    conn = await pool.getConnection();

    // ✅ ตรวจสอบว่ามีพนักงานจริงไหม
    const check = await conn.query(
      "SELECT employee_id FROM employees WHERE employee_id = ?",
      [id]
    );
    if (check.length === 0) {
      return res.status(404).json({ error: "ไม่พบพนักงาน" });
    }

    // ✅ ลบพนักงาน
    await conn.query("DELETE FROM employees WHERE employee_id = ?", [id]);

    res.json({ message: "ลบข้อมูลพนักงานเรียบร้อยแล้ว" });
  } catch (err) {
    console.error("Delete Employee Error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของ server" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = app;
