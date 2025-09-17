const express = require("express");

module.exports = (db) => {
  const router = express.Router();

  // ===== ดึงลอตเตอรี่ทั้งหมด =====
  router.get("/", (req, res) => {
    db.all("SELECT * FROM lottery_numbers ORDER BY id ASC", [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  // ===== ดึงเลขที่ยังไม่ขาย =====
  router.get("/available", (req, res) => {
    db.all("SELECT * FROM lottery_numbers WHERE status = 'available'", [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  // ===== ดึงเลขทั้งหมดที่ user ซื้อ =====
  router.get("/:user_id", (req, res) => {
    const user_id = req.params.user_id;
    db.all(
      "SELECT id, number, price, status FROM lottery_numbers WHERE user_id = ?",
      [user_id],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
      }
    );
  });

  // ===== ซื้อเลขลอตเตอรี่ =====
  router.post("/buy", (req, res) => {
    const { user_id, lottery_id } = req.body;
    if (!user_id || !lottery_id)
      return res.status(400).json({ error: "user_id and lottery_id required" });

    db.get("SELECT * FROM lottery_numbers WHERE id = ?", [lottery_id], (err, lottery) => {
      if (err || !lottery) return res.status(404).json({ error: "Lottery not found" });
      if (lottery.status !== "available")
        return res.status(400).json({ error: "Lottery already sold" });

      db.get("SELECT * FROM wallets WHERE user_id = ?", [user_id], (err, wallet) => {
        if (err || !wallet) return res.status(404).json({ error: "Wallet not found" });
        if (wallet.balance < lottery.price)
          return res.status(400).json({ error: "Insufficient balance" });

        const newBalance = wallet.balance - lottery.price;
        db.run("UPDATE wallets SET balance = ? WHERE id = ?", [newBalance, wallet.id]);

        db.run(
          "UPDATE lottery_numbers SET status = 'sold', user_id = ? WHERE id = ?",
          [user_id, lottery_id],
          function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Lottery purchased", lottery_id, new_balance: newBalance });
          }
        );
      });
    });
  });

  // ===== ตรวจผลลอตเตอรี่ของ user =====
  router.get("/check/:user_id", (req, res) => {
    const user_id = req.params.user_id;
    db.all(
      `SELECT l.id AS lottery_id, l.number, l.price, r.prize_rank, r.prize_amount
       FROM lottery_numbers l
       JOIN redemptions r ON l.id = r.lottery_id
       WHERE l.user_id = ?`,
      [user_id],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
      }
    );
  });

  // ===== Owner: สร้างเลขลอตเตอรี่ใหม่ =====
  router.post("/create", (req, res) => {
    const { owner_id, count, price } = req.body;
    if (!owner_id || !count || !price)
      return res.status(400).json({ error: "owner_id, count, and price required" });

    db.get("SELECT * FROM users WHERE id = ? AND role = 'owner'", [owner_id], (err, user) => {
      if (err || !user) return res.status(403).json({ error: "Not authorized" });

      const numbers = new Set();
      while (numbers.size < count) {
        const num = Math.floor(100000 + Math.random() * 900000).toString();
        numbers.add(num);
      }

      const numbersArray = Array.from(numbers);
      const placeholders = numbersArray.map(() => "(?, ?, 'available')").join(", ");
      const values = numbersArray.flatMap(num => [num, price]);

      db.run(`INSERT INTO lottery_numbers (number, price, status) VALUES ${placeholders}`, values, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Lotteries created", count: numbersArray.length, numbers: numbersArray });
      });
    });
  });

  // ===== ขึ้นเงินรางวัล =====
  router.post("/redeem/:user_id/:lottery_id", (req, res) => {
    const { user_id, lottery_id } = req.params;

    db.get(
      `SELECT r.prize_amount 
       FROM redemptions r
       JOIN lottery_numbers l ON r.lottery_id = l.id
       WHERE r.lottery_id = ? AND l.user_id = ?`,
      [lottery_id, user_id],
      (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(400).json({ error: "This ticket did not win any prize" });

        const prizeAmount = row.prize_amount;
        db.run(`UPDATE wallets SET balance = balance + ? WHERE user_id = ?`, [prizeAmount, user_id], function (err) {
          if (err) return res.status(500).json({ error: err.message });

          db.run(`DELETE FROM lottery_numbers WHERE id = ?`, [lottery_id], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            db.run(`DELETE FROM redemptions WHERE lottery_id = ?`, [lottery_id], (err) => {
              if (err) return res.status(500).json({ error: err.message });
              res.json({ message: "Prize redeemed successfully. Ticket deleted.", amount: prizeAmount });
            });
          });
        });
      }
    );
  });

  // ===== Owner: ลบล็อตโต้ทั้งหมด =====
  router.post("/delete-all", (req, res) => {
    const { owner_id } = req.body;
    if (!owner_id) return res.status(400).json({ error: "owner_id is required" });

    // ตรวจสอบว่าเป็น owner
    db.get("SELECT * FROM users WHERE id = ? AND role = 'owner'", [owner_id], (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(403).json({ error: "Not authorized" });

      db.serialize(() => {
        db.run("DELETE FROM redemptions");
        db.run("DELETE FROM prizes");
        db.run("DELETE FROM lottery_numbers");

        res.json({ message: "All lotteries deleted" });
      });
    });
  });

  return router;
};
