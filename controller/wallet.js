const express = require("express");

module.exports = (db) => {
  const router = express.Router();

  // ===== เติมเงินเข้ากระเป๋า =====
  router.post("/topup", (req, res) => {
    const { user_id, amount } = req.body;

    if (!user_id || !amount || amount <= 0) {
      return res.status(400).json({ error: "user_id and valid amount required" });
    }

    // เช็คว่ามี wallet แล้วหรือยัง
    db.get("SELECT * FROM wallets WHERE user_id = ?", [user_id], (err, wallet) => {
      if (err) return res.status(500).json({ error: err.message });

      if (!wallet) {
        // ยังไม่มี → สร้างใหม่
        db.run("INSERT INTO wallets (user_id, balance) VALUES (?, ?)", [user_id, amount], function (err) {
          if (err) return res.status(500).json({ error: err.message });
          return res.json({ message: "Wallet created and topped up", balance: amount });
        });
      } else {
        // มีแล้ว → อัปเดต balance
        const newBalance = wallet.balance + amount;
        db.run("UPDATE wallets SET balance = ? WHERE user_id = ?", [newBalance, user_id], function (err) {
          if (err) return res.status(500).json({ error: err.message });
          return res.json({ message: "Wallet topped up", balance: newBalance });
        });
      }
    });
  });

  // ===== ดึงยอดคงเหลือ =====
  router.get("/:user_id/balance", (req, res) => {
    const { user_id } = req.params;
    db.get("SELECT balance FROM wallets WHERE user_id = ?", [user_id], (err, wallet) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!wallet) return res.status(404).json({ error: "Wallet not found" });
      res.json({ balance: wallet.balance });
    });
  });

  // ===== ดึง wallet ทั้งหมด (option เผื่อ admin) =====
  router.get("/all", (req, res) => {
    db.all("SELECT * FROM wallets", [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  return router;
};
