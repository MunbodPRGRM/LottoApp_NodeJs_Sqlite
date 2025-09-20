const express = require("express");

module.exports = (db) => {
  const router = express.Router();

  // ===== รีเซ็ตระบบทั้งหมด =====
  router.post("/reset", (req, res) => {
    const { owner_id } = req.body; // รับ owner_id จาก request body

    // ตรวจสอบว่า user ที่ส่งมาเป็น owner จริงหรือไม่
    db.get(
      "SELECT * FROM users WHERE id = ? AND role = 'owner'",
      [owner_id],
      (err, user) => {
        // ถ้ามี error หรือไม่ใช่ owner -> ห้ามเข้าถึง
        if (err || !user) return res.status(403).json({ error: "Not authorized" });

        // ใช้ serialize เพื่อให้ query ทำงานแบบลำดับต่อเนื่อง
        db.serialize(() => {
          // ลบข้อมูลการแลกรางวัลทั้งหมด
          db.run("DELETE FROM redemptions");

          // ลบข้อมูลรางวัลทั้งหมด
          db.run("DELETE FROM prizes");

          // ลบข้อมูลการจับรางวัลทั้งหมด
          db.run("DELETE FROM draws");

          // ลบหมายเลขล็อตเตอรี่ทั้งหมด
          db.run("DELETE FROM lottery_numbers");

          // ลบ wallet ของผู้ใช้ที่ไม่ใช่ owner
          db.run("DELETE FROM wallets WHERE user_id != ?", [owner_id]);

          // ลบผู้ใช้ที่ไม่ใช่ owner
          db.run("DELETE FROM users WHERE role != 'owner'");

          // ตอบกลับว่าการรีเซ็ตเสร็จสิ้น
          res.json({ message: "System reset complete (owner wallet preserved)" });
        });
      }
    );
  });

  // ===== health check =====
  // ใช้สำหรับตรวจสอบว่า API ยังทำงานได้ปกติ
  router.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date() }); 
  });

  return router; // ส่ง router ออกไปให้ไฟล์หลักใช้งาน
};
