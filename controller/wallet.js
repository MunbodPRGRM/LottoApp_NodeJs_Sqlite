const express = require("express");

module.exports = (db) => {
  const router = express.Router();

  // ===== เติมเงินเข้ากระเป๋า (Top up wallet) =====
  router.post("/topup", (req, res) => {
    const { user_id, amount } = req.body; // รับ user_id และจำนวนเงิน

    // ตรวจสอบ input: ต้องมี user_id และ amount > 0
    if (!user_id || !amount || amount <= 0) {
      return res.status(400).json({ error: "user_id and valid amount required" });
    }

    // ตรวจสอบว่าผู้ใช้มี wallet อยู่แล้วหรือยัง
    db.get("SELECT * FROM wallets WHERE user_id = ?", [user_id], (err, wallet) => {
      if (err) return res.status(500).json({ error: err.message });

      if (!wallet) {
        // ยังไม่มี wallet -> สร้างใหม่พร้อมเติมเงินเข้าไป
        db.run(
          "INSERT INTO wallets (user_id, balance) VALUES (?, ?)",
          [user_id, amount],
          function (err) {
            if (err) return res.status(500).json({ error: err.message });
            return res.json({ message: "Wallet created and topped up", balance: amount });
          }
        );
      } else {
        // มี wallet อยู่แล้ว -> update ยอด balance
        const newBalance = wallet.balance + amount;
        db.run(
          "UPDATE wallets SET balance = ? WHERE user_id = ?",
          [newBalance, user_id],
          function (err) {
            if (err) return res.status(500).json({ error: err.message });
            return res.json({ message: "Wallet topped up", balance: newBalance });
          }
        );
      }
    });
  });

  // ===== ดึงยอดคงเหลือของ wallet =====
  router.get("/:user_id/balance", (req, res) => {
    const { user_id } = req.params;

    // หายอดคงเหลือตาม user_id
    db.get("SELECT balance FROM wallets WHERE user_id = ?", [user_id], (err, wallet) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!wallet) return res.status(404).json({ error: "Wallet not found" }); // ยังไม่มี wallet
      res.json({ balance: wallet.balance });
    });
  });

  // ===== ดึงข้อมูล wallet ทั้งหมด =====
  router.get("/all", (req, res) => {
    db.all("SELECT * FROM wallets", [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows); // คืนค่าทุก wallet
    });
  });

  return router;
};
