const express = require("express");
const pool = require("./db");
const authMiddleware = require("./authMiddleware");

const app = express();
app.use(express.json());

app.post("/api/chemicals/add", authMiddleware, async (req, res) => {
  const {
    chemical_name,
    chemical_type,
    quantity,
    received_date,
    expiry_date,
    company_name,
    price,
  } = req.body;

  let conn;
  try {
    conn = await pool.getConnection();

    console.log("📩 [REQ] ข้อมูลที่ได้รับจาก Frontend:", {
      chemical_name,
      chemical_type,
      quantity,
      received_date,
      expiry_date,
      company_name,
      price,
    });

    // ---------------------------
    // ✅ ตรวจสอบประเภทสารเคมี
    // ---------------------------
    if (!chemical_type) {
      console.log("❌ ไม่พบค่า chemical_type ใน req.body");
      return res.status(400).json({ error: "กรุณาระบุประเภทสารเคมี" });
    }

    const typeRows = await conn.query(
      "SELECT type_id FROM chemical_types WHERE LOWER(type_name) = LOWER(?) LIMIT 1",
      [chemical_type]
    );

    console.log("🔍 [DEBUG] ผลลัพธ์จาก chemical_types:", typeRows);

    let typeId;
    if (Array.isArray(typeRows) && typeRows.length > 0 && typeRows[0].type_id) {
      typeId = typeRows[0].type_id;
    } else if (
      Array.isArray(typeRows[0]) &&
      typeRows[0].length > 0 &&
      typeRows[0][0].type_id
    ) {
      typeId = typeRows[0][0].type_id;
    }

    if (!typeId) {
      console.log("⚠️ [DEBUG] ไม่พบ type_id สำหรับ:", chemical_type);
      return res
        .status(400)
        .json({ error: `ไม่พบประเภทสารเคมี '${chemical_type}' ในระบบ` });
    }

    console.log("✅ [DEBUG] type_id ที่พบ:", typeId);

    // ---------------------------
    // ✅ ตรวจสอบข้อมูลซ้ำ (ชื่อ + ประเภท + วันหมดอายุ)
    // ---------------------------
    const existResult = await conn.query(
      `SELECT chemical_id, quantity 
       FROM chemicals 
       WHERE chemical_name = ? 
         AND chemical_type = ? 
         AND expiry_date = ?
       LIMIT 1`,
      [chemical_name, chemical_type, expiry_date]
    );

    console.log("🔍 [DEBUG] ผลลัพธ์จากการตรวจซ้ำ (raw):", existResult);

    let existRows = [];
    if (Array.isArray(existResult) && existResult.length > 0) {
      // ✅ ถ้าเป็น array ของ object
      if (existResult[0] && existResult[0].chemical_id) {
        existRows = [existResult[0]];
      }
      // ✅ ถ้าเป็น array ซ้อน เช่น [ [ { chemical_id: 'chacc000001' } ], fields ]
      else if (
        Array.isArray(existResult[0]) &&
        existResult[0].length > 0 &&
        existResult[0][0].chemical_id
      ) {
        existRows = existResult[0];
      }
    } else if (existResult && existResult.chemical_id) {
      // ✅ ถ้าเป็น object เดี่ยว
      existRows = [existResult];
    }

    console.log("🔍 [DEBUG] existRows ที่ประมวลผลแล้ว:", existRows);

    if (existRows.length > 0) {
      // ✅ ถ้ามีข้อมูลซ้ำ → update แทน
      const oldQty = parseFloat(existRows[0].quantity || 0);
      const newQty = oldQty + parseFloat(quantity || 0);

      console.log("🔁 [DEBUG] เจอสารเคมีซ้ำ → update จำนวนเพิ่ม:", {
        chemical_id: existRows[0].chemical_id,
        oldQty,
        add: quantity,
        newQty,
      });

      await conn.query(
        `UPDATE chemicals 
         SET quantity = ?, received_date = ?, company_name = ?, price = ? 
         WHERE chemical_id = ?`,
        [newQty, received_date, company_name, price, existRows[0].chemical_id]
      );

      console.log("✅ [UPDATE SUCCESS] chemical_id:", existRows[0].chemical_id);

      return res.json({
        message: "พบข้อมูลสารเคมีซ้ำ → บวกจำนวนเพิ่มเรียบร้อยแล้ว",
        chemical_id: existRows[0].chemical_id,
        new_quantity: newQty,
      });
    }

    // ---------------------------
    // ✅ ถ้าไม่ซ้ำ → gen ID ใหม่
    // ---------------------------
    const prefix = "ch" + typeId;
    console.log("🧩 [DEBUG] prefix:", prefix);

    const maxIdResult = await conn.query(
      "SELECT chemical_id FROM chemicals WHERE chemical_id LIKE ? ORDER BY chemical_id DESC LIMIT 1",
      [prefix + "%"]
    );

    console.log("📊 [DEBUG] MaxID Query (raw):", maxIdResult);

    let maxIdRows = [];
    if (Array.isArray(maxIdResult) && maxIdResult.length > 0) {
      if (Array.isArray(maxIdResult[0])) {
        maxIdRows = maxIdResult[0];
      } else {
        maxIdRows = maxIdResult;
      }
    }

    console.log("📊 [DEBUG] maxIdRows ที่ประมวลผลแล้ว:", maxIdRows);

    let runNo = 1;
    if (maxIdRows.length > 0) {
      const lastId = maxIdRows[0].chemical_id;
      runNo = parseInt(lastId.slice(prefix.length)) + 1;
      console.log("⚙️ [DEBUG] พบ running ล่าสุด:", lastId, "→ runNo ใหม่:", runNo);
    } else {
      console.log("🆕 [DEBUG] ไม่มี ID เดิม → เริ่ม runNo = 1");
    }

    const newId = prefix + runNo.toString().padStart(6, "0");
    console.log("🆔 [DEBUG] chemical_id ใหม่:", newId);

    // ✅ insert สารเคมีใหม่
    await conn.query(
      `INSERT INTO chemicals
       (chemical_id, chemical_name, chemical_type, quantity, received_date, expiry_date, company_name, price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId,
        chemical_name,
        chemical_type,
        quantity,
        received_date,
        expiry_date,
        company_name,
        price,
      ]
    );

    console.log("✅ [SUCCESS] เพิ่มสารเคมีใหม่สำเร็จ:", newId);

    res.json({
      message: "เพิ่มสารเคมีใหม่สำเร็จ",
      chemical_id: newId,
    });
  } catch (err) {
    console.error("❌ [ERROR] Add Chemical Error:", err);
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

// ✅ ดึงประเภทสารเคมีทั้งหมด (เพื่อแสดงใน dropdown)
app.get("/api/chemicals/types", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    // 🔹 Query ข้อมูลจากตาราง chemical_types
    const rows = await conn.query(
      "SELECT type_name FROM chemical_types ORDER BY type_name ASC"
    );

    // ✅ ส่งผลลัพธ์กลับเป็น JSON เช่น { types: [ {type_name: 'Acid'}, ... ] }
    res.json({ types: rows });
  } catch (err) {
    console.error("Get Chemical Types Error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    if (conn) conn.release();
  }
});


// ✅ ลบสารเคมีตาม chemical_id
app.delete("/api/chemicals/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;

  let conn;
  try {
    conn = await pool.getConnection();

    // ตรวจสอบว่ามี chemical_id นี้อยู่จริงไหม
    const check = await conn.query(
      "SELECT chemical_id FROM chemicals WHERE chemical_id = ?",
      [id]
    );

    if (check.length === 0) {
      return res.status(404).json({ error: "ไม่พบสารเคมีที่ต้องการลบ" });
    }

    // ลบข้อมูล
    await conn.query("DELETE FROM chemicals WHERE chemical_id = ?", [id]);

    res.json({ message: "ลบสารเคมีสำเร็จ", chemical_id: id });
  } catch (err) {
    console.error("Delete Chemical Error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    if (conn) conn.release();
  }
});

// ✅ แก้ไขข้อมูลสารเคมี (เฉพาะฟิลด์หลัก)
app.put("/api/chemicals/:id", authMiddleware, async (req, res) => {
  const { id } = req.params; // รับ ID สารเคมีจาก URL เช่น /api/chemicals/5
  const { chemical_name, chemical_type, quantity, expiry_date } = req.body; // รับค่าจาก body

  let conn;
  try {
    conn = await pool.getConnection();

    // ------------------------------------------------
    // 🔍 ตรวจสอบว่ามีสารเคมีนี้อยู่ในฐานข้อมูลไหม
    // ------------------------------------------------
    const [check] = await conn.query(
      "SELECT chemical_id FROM chemicals WHERE chemical_id = ?",
      [id]
    );

    if (!check || check.length === 0) {
      return res.status(404).json({ error: "ไม่พบสารเคมีที่ต้องการแก้ไข" });
    }

    // ------------------------------------------------
    // ✅ อัปเดตข้อมูล (update เฉพาะฟิลด์ที่อนุญาตให้แก้ไข)
    // ------------------------------------------------
    await conn.query(
      `
      UPDATE chemicals
      SET 
        chemical_name = ?,     -- ชื่อสาร
        chemical_type = ?,     -- ประเภท (acid/base/ฯลฯ)
        quantity = ?,          -- จำนวน
        expiry_date = ?        -- วันหมดอายุ
      WHERE chemical_id = ?
      `,
      [chemical_name, chemical_type, quantity, expiry_date, id]
    );

    // ------------------------------------------------
    // ✅ ส่งผลลัพธ์กลับไปยัง Frontend
    // ------------------------------------------------
    res.json({ message: "แก้ไขสารเคมีสำเร็จ", chemical_id: id });
  } catch (err) {
    console.error("Update Chemical Error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    if (conn) conn.release(); // ปล่อยการเชื่อมต่อกลับสู่ pool
  }
});



module.exports = app;