const express = require("express");

module.exports = (db) => {
  const router = express.Router();  // ใช้ Express Router รวม API เกี่ยวกับ lottery

  // ===== ดึงลอตเตอรี่ทั้งหมด =====
  router.get("/", (req, res) => {
    // SELECT ลอตเตอรี่ทั้งหมดจากตาราง lottery_numbers
    db.all("SELECT * FROM lottery_numbers ORDER BY id ASC", [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows); // ส่งกลับเป็น JSON array
    });
  });

  // ===== ดึงเลขที่ยังไม่ขาย =====
  router.get("/available", (req, res) => {
    // SELECT เฉพาะที่ status = 'available'
    db.all("SELECT * FROM lottery_numbers WHERE status = 'available'", [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  // ===== ดึงเลขทั้งหมดที่ user ซื้อ =====
  router.get("/:user_id", (req, res) => {
    const user_id = req.params.user_id;
    // แสดงรายการที่ user_id ซื้อไปแล้ว
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

    // เช็คว่ามี lottery นี้อยู่จริง
    db.get("SELECT * FROM lottery_numbers WHERE id = ?", [lottery_id], (err, lottery) => {
      if (err || !lottery) return res.status(404).json({ error: "Lottery not found" });
      if (lottery.status !== "available")
        return res.status(400).json({ error: "Lottery already sold" });

      // เช็คว่า user มี wallet และ balance เพียงพอ
      db.get("SELECT * FROM wallets WHERE user_id = ?", [user_id], (err, wallet) => {
        if (err || !wallet) return res.status(404).json({ error: "Wallet not found" });
        if (wallet.balance < lottery.price)
          return res.status(400).json({ error: "Insufficient balance" });

        const newBalance = wallet.balance - lottery.price;

        // หักเงินใน wallet
        db.run("UPDATE wallets SET balance = ? WHERE id = ?", [newBalance, wallet.id]);

        // อัพเดทสถานะ lottery เป็น sold และบันทึกว่า user_id คนนี้ซื้อ
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

    // ดึงรางวัลของผู้ใช้แล้วกรองเลขซ้ำ
    db.all(
      `SELECT l.id AS lottery_id, l.number, l.price, r.prize_rank, r.prize_amount
      FROM lottery_numbers l
      JOIN redemptions r ON l.id = r.lottery_id
      WHERE l.user_id = ?
      GROUP BY l.number`, // <<< เพิ่ม GROUP BY เพื่อตัดเลขซ้ำ
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

    // ตรวจสอบสิทธิ์ว่าเป็น owner จริง
    db.get("SELECT * FROM users WHERE id = ? AND role = 'owner'", [owner_id], (err, user) => {
      if (err || !user) return res.status(403).json({ error: "Not authorized" });

      // ✅ สุ่มเลขลอตเตอรี่ 6 หลัก ไม่ให้ซ้ำกัน
      const numbers = new Set();
      while (numbers.size < count) {
        const num = Math.floor(100000 + Math.random() * 900000).toString();
        numbers.add(num);
      }

      // ✅ เตรียม insert หลายแถวในคำสั่งเดียว
      const numbersArray = Array.from(numbers);
      const placeholders = numbersArray.map(() => "(?, ?, 'available')").join(", ");    // "(?, ?, 'available'), (?, ?, 'available'), ..."
      const values = numbersArray.flatMap(num => [num, price]);   // [num1, price, num2, price, num3, price, ...]

      // ✅ Insert ลอตเตอรี่ใหม่เข้า DB
      db.run(`INSERT INTO lottery_numbers (number, price, status) VALUES ${placeholders}`, values, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Lotteries created", count: numbersArray.length, numbers: numbersArray });
      });
    });
  });

  // ===== ขึ้นเงินรางวัล =====
  router.post("/redeem/:user_id", (req, res) => {
    const { user_id } = req.params;
    const { lotto_number } = req.body;

    if (!lotto_number)
      return res.status(400).json({ error: "lotto_number is required" });

    // หาเลขที่ถูกรางวัล (อาจถูกรางวัลหลายประเภท)
    db.all(
      `SELECT r.prize_amount, r.prize_rank, l.id AS lottery_id
      FROM redemptions r
      JOIN lottery_numbers l ON r.lottery_id = l.id
      WHERE l.number = ? AND l.user_id = ?`,
      [lotto_number, user_id],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!rows || rows.length === 0)
          return res.status(400).json({ error: "This ticket did not win any prize" });

        // รวมเงินรางวัลทั้งหมด
        const totalPrize = rows.reduce((sum, r) => sum + r.prize_amount, 0);
        const lotteryId = rows[0].lottery_id;

        // รายละเอียดรางวัล
        const prizes = rows.map(r => ({
          rank: r.prize_rank,
          amount: r.prize_amount
        }));

        // อัพเดตเงินเข้ากระเป๋า
        db.run(
          `UPDATE wallets SET balance = balance + ? WHERE user_id = ?`,
          [totalPrize, user_id],
          function (err) {
            if (err) return res.status(500).json({ error: err.message });

            // ลบตั๋วออก
            db.run(`DELETE FROM lottery_numbers WHERE id = ?`, [lotteryId], (err) => {
              if (err) return res.status(500).json({ error: err.message });

              // ลบข้อมูลรางวัลที่แลกแล้ว
              db.run(`DELETE FROM redemptions WHERE lottery_id = ?`, [lotteryId], (err) => {
                if (err) return res.status(500).json({ error: err.message });

                res.json({
                  message: "Prize redeemed successfully. Ticket deleted.",
                  amount: totalPrize,
                  prizes: prizes
                });
              });
            });
          }
        );
      }
    );
  });

  // ===== Owner: ลบล็อตโต้ทั้งหมด =====
  router.post("/delete-all", (req, res) => {
    const { owner_id } = req.body;
    if (!owner_id) return res.status(400).json({ error: "owner_id is required" });

    // ตรวจสอบสิทธิ์ว่าเป็น owner จริง
    db.get("SELECT * FROM users WHERE id = ? AND role = 'owner'", [owner_id], (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(403).json({ error: "Not authorized" });

      // ลบข้อมูลทั้งหมดที่เกี่ยวข้อง (reset ระบบ)
      db.serialize(() => {
        db.run("DELETE FROM redemptions");
        db.run("DELETE FROM prizes");
        db.run("DELETE FROM lottery_numbers");

        res.json({ message: "All lotteries deleted" });
      });
    });
  });

  return router; // ส่ง router ออกไปให้ server.js ใช้งาน
};
