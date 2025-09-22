const express = require("express");

module.exports = (db) => {
  const router = express.Router();

  // ฟังก์ชันสุ่มค่า element จาก array (ใช้ในการสุ่มผลรางวัล)
  const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // กำหนดจำนวนเงินรางวัลตามลำดับที่ถูกรางวัล
  const prizeAmounts = {
    1: 10000, // รางวัลที่ 1
    2: 5000,  // รางวัลที่ 2
    3: 3000,  // รางวัลที่ 3
    4: 500,   // รางวัลเลขท้าย 3 ตัว
    5: 200,   // รางวัลเลขท้าย 2 ตัว
  };

  // ===== PREVIEW: สุ่มผลรางวัล (ยังไม่บันทึกลง DB) =====
  router.post("/preview", (req, res) => {
    const { mode } = req.body; // mode มีค่า "sold_only" หรือ "all_numbers"

    // query เลือกหมายเลขล็อตเตอรี่ทั้งหมด
    let query = "SELECT * FROM lottery_numbers";
    if (mode === "sold_only") query += " WHERE status = 'sold'"; // เลือกเฉพาะที่ขายแล้ว

    db.all(query, [], (err, numbers) => {
      if (err) return res.status(500).json({ error: err.message });
      if (numbers.length === 0) return res.status(400).json({ error: "No numbers to draw" });

      // ทำสำเนา array ไว้เพื่อใช้สุ่มแบบไม่ซ้ำ
      let availableNumbers = [...numbers];

      function pickUnique() {
        const idx = Math.floor(Math.random() * availableNumbers.length);
        const chosen = availableNumbers[idx];
        availableNumbers.splice(idx, 1); // ลบออกจาก pool
        return chosen.number;
      }

      // รางวัลที่ 1
      const firstPrize = pickUnique();

      // รางวัลอื่น ๆ (ไม่ซ้ำกัน)
      const secondPrize = pickUnique();
      const thirdPrize = pickUnique();
      const fifthPrize = pickUnique();

      const results = {
        1: firstPrize,          // รางวัลที่ 1 → เลขตรงทั้งหมด
        2: secondPrize,         // รางวัลที่ 2 → ไม่ซ้ำกับรางวัลที่ 1
        3: thirdPrize,          // รางวัลที่ 3 → ไม่ซ้ำ
        4: firstPrize.slice(-3),// เลขท้าย 3 ตัว → มาจากรางวัลที่ 1
        5: fifthPrize.slice(-2) // เลขท้าย 2 ตัว → ไม่ซ้ำ
      };

      res.json({ preview: results, prizeAmounts });
    });
  });

  // ===== CONFIRM: ยืนยันผลรางวัล (บันทึกลง DB) =====
  router.post("/confirm", (req, res) => {
    const { mode, results } = req.body;
    if (!results) return res.status(400).json({ error: "results required" });

    // query เลือกหมายเลขล็อตเตอรี่
    let query = "SELECT * FROM lottery_numbers";
    if (mode === "sold_only") query += " WHERE status = 'sold'";

    db.all(query, [], (err, numbers) => {
      if (err) return res.status(500).json({ error: err.message });
      if (numbers.length === 0) return res.status(400).json({ error: "No numbers to draw" });

      // 🔹 ลบรางวัลและการขึ้นเงินเก่าก่อน (ถ้ามี)
      db.serialize(() => {
        db.run("DELETE FROM prizes");
        db.run("DELETE FROM redemptions");

        // บันทึกการออกรางวัลใหม่ลงตาราง draws
        db.run("INSERT INTO draws (mode) VALUES (?)", [mode], function (err) {
          if (err) return res.status(500).json({ error: err.message });
          const draw_id = this.lastID; // เก็บค่า id ของงวดล่าสุด

          let prizeResults = [];

          // วน loop ทุกลำดับรางวัลที่ได้จาก results
          Object.entries(results).forEach(([rank, prize_number]) => {
            const prize_amount = prizeAmounts[rank];

            // บันทึกผลรางวัลลงตาราง prizes
            db.run(
              "INSERT INTO prizes (draw_id, prize_rank, prize_number, prize_amount) VALUES (?, ?, ?, ?)",
              [draw_id, rank, prize_number, prize_amount]
            );

            // หาผู้ถูกรางวัล
            let winners = [];
            if (rank <= 3) {
              winners = numbers.filter((n) => n.number === prize_number);
            } else {
              winners = numbers.filter((n) => n.number.endsWith(prize_number));
            }

            // บันทึกการขึ้นเงินรางวัลลงตาราง redemptions
            winners.forEach((winner) => {
              db.run(
                "INSERT INTO redemptions (lottery_id, draw_id, prize_rank, prize_amount) VALUES (?, ?, ?, ?)",
                [winner.id, draw_id, rank, prize_amount]
              );
            });

            prizeResults.push({
              prize_rank: rank,
              prize_number,
              prize_amount,
              winners: winners.length,
            });
          });

          // ตอบกลับพร้อมรายละเอียดผลรางวัล
          res.json({ message: "Draw confirmed", draw_id, prizes: prizeResults });
        });
      });
    });
  });

  // ===== ดึงผลออกรางวัลทั้งหมด (history) =====
  router.get("/all", (req, res) => {
    db.all("SELECT * FROM draws ORDER BY id DESC", [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  // ===== ดึงผลออกรางวัลล่าสุด =====
  router.get("/latest", (req, res) => {
    db.get("SELECT * FROM draws ORDER BY id DESC LIMIT 1", [], (err, draw) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!draw) return res.status(404).json({ error: "No draws found" });

      // เอารางวัลของงวดล่าสุดออกมา
      db.all("SELECT * FROM prizes WHERE draw_id = ? ORDER BY prize_rank ASC", [draw.id], (err, prizes) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(prizes);
      });
    });
  });

  // ===== ดูรางวัลทั้งหมดของงวดที่เลือก =====
  router.get("/:draw_id/prizes", (req, res) => {
    const { draw_id } = req.params;
    db.all("SELECT * FROM prizes WHERE draw_id = ?", [draw_id], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  // ===== ดูการขึ้นเงินทั้งหมดของงวดที่เลือก =====
  router.get("/:draw_id/redemptions", (req, res) => {
    const { draw_id } = req.params;
    db.all("SELECT * FROM redemptions WHERE draw_id = ?", [draw_id], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  return router;
};
