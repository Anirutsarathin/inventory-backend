// const express = require("express");
// const bcrypt = require("bcrypt");
// const jwt = require("jsonwebtoken");
// const bodyParser = require("body-parser");
// const cors = require("cors");
// const pool = require("./db");

// const app = express();
// app.use(cors({
//   origin: "*",
//   methods: ["GET", "POST", "PUT", "DELETE"],
//   allowedHeaders: ["Content-Type", "Authorization"]
// }));

// app.use(bodyParser.json());
// const JWT_SECRET = "my_secret_key";

// // API Login
// app.post("/api/login", async (req, res) => {
//   const { user, password } = req.body;

//   if (!user || !password) {
//     return res.status(400).json({ error: "กรุณากรอก user และ password" });
//   }

//   let conn;
//   try {
//     conn = await pool.getConnection();

//     const rows = await conn.query(
//       `SELECT employee_id, first_name, last_name, phone, email, password, status, login_attempts,position_id
//        FROM employees 
//        WHERE phone = ? OR email = ? 
//        LIMIT 1`,
//       [user, user]
//     );

//     if (rows.length === 0) {
//       return res.status(401).json({ error: "ไม่พบผู้ใช้งาน" });
//     }

//     const emp = rows[0];

//     // ตรวจสอบสถานะบัญชี
//     if (emp.status !== 1) {
//       return res.status(403).json({ error: "บัญชีนี้ถูกระงับการใช้งาน" });
//     }

//     // ตรวจสอบรหัสผ่าน
//     const match = await bcrypt.compare(password, emp.password);
//     if (!match) {
//       const attempts = emp.login_attempts + 1;

//       if (attempts >= 3) {
//         // ล็อกบัญชี
//         await conn.query(
//           "UPDATE employees SET status = 0, login_attempts = ? WHERE employee_id = ?",
//           [attempts, emp.employee_id]
//         );
//         return res.status(403).json({ error: "รหัสผ่านผิดเกิน 3 ครั้ง บัญชีถูกระงับการใช้งาน" });
//       } else {
//         // อัปเดตจำนวนครั้งที่พยายามผิด
//         await conn.query(
//           "UPDATE employees SET login_attempts = ? WHERE employee_id = ?",
//           [attempts, emp.employee_id]
//         );
//         return res.status(401).json({ error: `รหัสผ่านไม่ถูกต้อง (พยายาม ${attempts}/3 ครั้ง)` });
//       }
//     }

//     // ถ้า login สำเร็จ → reset attempts
//     await conn.query(
//       "UPDATE employees SET login_attempts = 0 WHERE employee_id = ?",
//       [emp.employee_id]
//     );

//     // สร้าง JWT
//   const token = jwt.sign(
//   { 
//     id: emp.employee_id, 
//     phone: emp.phone, 
//     email: emp.email, 
//     position_id: emp.position_id   // 👈 เพิ่มตรงนี้
//   },
//   JWT_SECRET,
//   { expiresIn: "300m" }
// );

//     res.json({
//       message: "เข้าสู่ระบบสำเร็จ",
//       token,
//       user: {
//         id: emp.employee_id,
//         first_name: emp.first_name,
//         last_name: emp.last_name,
//         phone: emp.phone,
//         email: emp.email,
//         position:emp.position_id,
//       }
//     });
//   } catch (err) {
//     console.error("Login Error:", err);
//     res.status(500).json({ error: "เกิดข้อผิดพลาดของ server" });
//   } finally {
//     if (conn) conn.release();
//   }
// });

// module.exports = app;

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

// ✅ API Login
app.post("/api/login", async (req, res) => {
  const { user, password } = req.body;

  if (!user || !password) {
    return res.status(400).json({ error: "กรุณากรอก user และ password" });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    // 1) หา user
    const rows = await conn.query(
      `SELECT employee_id, first_name, last_name, phone, email, password, status, login_attempts, position_id
       FROM employees 
       WHERE phone = ? OR email = ? 
       LIMIT 1`,
      [user, user]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "ไม่พบผู้ใช้งาน" });
    }

    const emp = rows[0];

    // 2) ตรวจสอบสถานะบัญชี
    if (emp.status !== 1) {
      return res.status(403).json({ error: "บัญชีนี้ถูกระงับการใช้งาน" });
    }

    // 3) ตรวจสอบรหัสผ่าน
    const match = await bcrypt.compare(password, emp.password);
    if (!match) {
      const attempts = emp.login_attempts + 1;

      if (attempts >= 3) {
        await conn.query(
          "UPDATE employees SET status = 0, login_attempts = ? WHERE employee_id = ?",
          [attempts, emp.employee_id]
        );
        return res.status(403).json({ error: "รหัสผ่านผิดเกิน 3 ครั้ง บัญชีถูกระงับ" });
      } else {
        await conn.query(
          "UPDATE employees SET login_attempts = ? WHERE employee_id = ?",
          [attempts, emp.employee_id]
        );
        return res.status(401).json({ error: `รหัสผ่านไม่ถูกต้อง (${attempts}/3 ครั้ง)` });
      }
    }

    // reset attempts
    await conn.query("UPDATE employees SET login_attempts = 0 WHERE employee_id = ?", [emp.employee_id]);

 // 4) หา permissions ของตำแหน่งนี้
const permRows = await conn.query(
  `SELECT DISTINCT pa.page_name
     FROM permissions pe
     JOIN positions po ON pe.position_id = po.position_id
     JOIN pages pa ON pe.page_id = pa.page_id
    WHERE pe.position_id = ? 
    ORDER BY pa.page_name`,
  [emp.position_id]
);

const permissions = permRows.map((r) => r.page_name);

    // 5) สร้าง JWT
    const token = jwt.sign(
      { id: emp.employee_id, phone: emp.phone, email: emp.email, position: emp.position_id },
      JWT_SECRET,
      { expiresIn: "300m" }
    );

    res.json({
      message: "เข้าสู่ระบบสำเร็จ",
      token,
      user: {
        id: emp.employee_id,
        first_name: emp.first_name,
        last_name: emp.last_name,
        phone: emp.phone,
        email: emp.email,
        position: emp.position_id
      },
      permissions
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของ server" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = app;
