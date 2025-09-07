const jwt = require("jsonwebtoken");
const JWT_SECRET = "my_secret_key";

function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).json({ error: "กรุณาใส่ Token" });
  }

  const token = authHeader.split(" ")[1]; // Bearer <token>
  if (!token) {
    return res.status(401).json({ error: "Token ไม่ถูกต้อง" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // เก็บข้อมูล user ไว้ใช้ต่อ
    next();
  } catch (err) {
    return res.status(403).json({ error: "Token หมดอายุหรือไม่ถูกต้อง" });
  }
}

module.exports = authMiddleware;
