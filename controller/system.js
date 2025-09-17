const express = require("express");

module.exports = (db) => {
  const router = express.Router();

  // ===== รีเซ็ตระบบทั้งหมด =====
  router.post("/reset", (req, res) => {
    const { owner_id } = req.body;
    db.get("SELECT * FROM users WHERE id = ? AND role = 'owner'", [owner_id], (err, user) => {
      if (err || !user) return res.status(403).json({ error: "Not authorized" });

      db.serialize(() => {
        db.run("DELETE FROM redemptions");
        db.run("DELETE FROM prizes");
        db.run("DELETE FROM draws");
        db.run("DELETE FROM lottery_numbers");
        db.run("DELETE FROM wallets");
        db.run("DELETE FROM users WHERE role != 'owner'");
        res.json({ message: "System reset complete" });
      });
    });
  });

  // ===== health check =====
  router.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date() });
  });

  return router;
};
