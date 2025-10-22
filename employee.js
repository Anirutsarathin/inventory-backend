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

// GET positionsrole
// ----------------------
app.get("/api/employees/position/role", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const rows = await conn.query(
   
      `SELECT 
          p.position_id as id,
          p.position_name as name
       FROM positions p
       where p.position_id not in (select p2.position_id from permissions p2 );`

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

// ----------------------
// POST add employee
// ----------------------
app.post("/api/add/employees", authMiddleware, async (req, res) => {
  let conn;
  const {
    first_name,
    last_name,
    phone,
    position_id,
    status,
    gender,
    email,
    address,
    subdistrict_id,
    district_id,
    province_id,
    start_date,
    password, // ✅ รับจาก client
  } = req.body;

  try {
    conn = await pool.getConnection();

    // ✅ validate input
    if (!first_name || !last_name || !position_id || !password) {
      return res.status(400).json({
        error: "กรุณากรอก first_name, last_name, position_id และ password",  
      });
    }

    // ✅ hash password ที่รับมา
    const bcrypt = require("bcrypt");
    const hashedPassword = await bcrypt.hash(password, 12);

    // ✅ insert
    const result = await conn.query(
      `INSERT INTO employees 
        (first_name, last_name, phone, password, gender, email, address, subdistrict_id, district_id, province_id, position_id, start_date, status, login_attempts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        first_name,
        last_name,
        phone || "",
        hashedPassword, // ✅ เก็บ password ที่ถูก hash
        gender || 0,
        email || "",
        address || "",
        subdistrict_id || null,
        district_id || null,
        province_id || null,
        position_id,
        start_date || new Date(),
        status ?? 1,
      ]
    );

    // ✅ ดึง record ล่าสุดที่เพิ่ง insert
    const [newEmployee] = await conn.query(
      `SELECT e.employee_id, e.first_name, e.last_name,
              CONCAT(e.first_name,' ',e.last_name) as name,
              p.position_id, p.position_name as position,
              e.phone, e.status,
              CASE WHEN e.status = 0 THEN 'INACTIVE' ELSE 'ACTIVE' END as status_label
       FROM employees e
       INNER JOIN positions p ON e.position_id = p.position_id
       WHERE e.employee_id = ?`,
      [result.insertId]
    );

    res.json(newEmployee);
  } catch (err) {
    console.error("Add Employee Error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของ server" });
  } finally {
    if (conn) conn.release();
  }
});

// GET Province 
// ----------------------
app.get("/api/employees/province", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const rows = await conn.query(
   
      `SELECT ProvinceID,ProvinceName  FROM province `

    );

    res.json({ employees: rows });
  } catch (err) {
    console.error("Get Province Error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของ server" });
  } finally {
    if (conn) conn.release();
  }
});
// GET Province 
// ----------------------
app.get("/api/employees/province", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    const rows = await conn.query(
   
      `SELECT ProvinceID,ProvinceName  FROM province `

    );

    res.json({ employees: rows });
  } catch (err) {
    console.error("Get Province Error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของ server" });
  } finally {
    if (conn) conn.release();
  }
});

// GET district 
// ----------------------
app.get("/api/employees/district", async (req, res) => {
  let conn;
  try {
    // ✅ รับ provinceId จาก query เช่น /api/employees/district?provinceId=10
    const { provinceId } = req.query;

    if (!provinceId) {
      return res.status(400).json({ error: "กรุณาระบุ provinceId" });
    }

    conn = await pool.getConnection();

    const sql = `
      SELECT 
        d.DistrictID,
        d.DistrictName
      FROM district d
      WHERE d.ProvinceID = ?
    `;

   const rows = await conn.query(sql, [provinceId]);


    res.json({ districts: rows });
  } catch (err) {
    console.error("Get District Error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของ server" });
  } finally {
    if (conn) conn.release();
  }
});

// GET sub_district 
// ----------------------
app.get("/api/employees/sub_district", async (req, res) => {
  let conn;
  try {
    const { DistrictID } = req.query;

    if (!DistrictID) {
      return res.status(400).json({ error: "กรุณาระบุ provinceId" });
    }

    conn = await pool.getConnection();

    const sql = `
      select 
      s.SubdistrictID,s.SubdistrictName,s.PostalCode
      from subdistrict s 
      where s.DistrictID = ?
    `;

   const rows = await conn.query(sql, [DistrictID]);


    res.json({ districts: rows });
  } catch (err) {
    console.error("Get District Error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของ server" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = app;
