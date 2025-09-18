const express = require("express");

module.exports = (db) => {
  const router = express.Router();

  // ฟังก์ชันสุ่มเลข
  const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const prizeAmounts = {
    1: 10000,
    2: 5000,
    3: 3000,
    4: 500,
    5: 200,
  };

  // ===== PREVIEW: สุ่มผลรางวัล (ยังไม่บันทึก) =====
  router.post("/preview", (req, res) => {
    const { mode } = req.body; // sold_only | all_numbers
    let query = "SELECT * FROM lottery_numbers";
    if (mode === "sold_only") query += " WHERE status = 'sold'";

    db.all(query, [], (err, numbers) => {
      if (err) return res.status(500).json({ error: err.message });
      if (numbers.length === 0) return res.status(400).json({ error: "No numbers to draw" });

      const results = {
        1: pickRandom(numbers).number,
        2: pickRandom(numbers).number,
        3: pickRandom(numbers).number,
        4: pickRandom(numbers).number.slice(-3),
        5: pickRandom(numbers).number.slice(-2),
      };

      res.json({ preview: results, prizeAmounts });
    });
  });

  // ===== CONFIRM: ยืนยันผลรางวัล (บันทึกลง DB) =====
  router.post("/confirm", (req, res) => {
    const { mode, results } = req.body;
    if (!results) return res.status(400).json({ error: "results required" });

    let query = "SELECT * FROM lottery_numbers";
    if (mode === "sold_only") query += " WHERE status = 'sold'";

    db.all(query, [], (err, numbers) => {
      if (err) return res.status(500).json({ error: err.message });
      if (numbers.length === 0) return res.status(400).json({ error: "No numbers to draw" });

      // บันทึก draw
      db.run("INSERT INTO draws (mode) VALUES (?)", [mode], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        const draw_id = this.lastID;

        let prizeResults = [];
        Object.entries(results).forEach(([rank, prize_number]) => {
          const prize_amount = prizeAmounts[rank];

          // บันทึกลงตาราง prizes
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

          // บันทึกการขึ้นเงิน
          winners.forEach((winner) => {
            db.run(
              "INSERT INTO redemptions (lottery_id, draw_id, prize_rank, prize_amount) VALUES (?, ?, ?, ?)",
              [winner.id, draw_id, rank, prize_amount]
            );
          });

          prizeResults.push({ prize_rank: rank, prize_number, prize_amount, winners: winners.length });
        });

        res.json({ message: "Draw confirmed", draw_id, prizes: prizeResults });
      });
    });
  });

  // ===== ดึงผลออกรางวัลทั้งหมด =====
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

      db.all("SELECT * FROM prizes WHERE draw_id = ? ORDER BY prize_rank ASC", [draw.id], (err, prizes) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(prizes);
      });
    });
  });

  // ===== ดูรางวัลของงวด =====
  router.get("/:draw_id/prizes", (req, res) => {
    const { draw_id } = req.params;
    db.all("SELECT * FROM prizes WHERE draw_id = ?", [draw_id], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  // ===== ดูการขึ้นเงินของงวด =====
  router.get("/:draw_id/redemptions", (req, res) => {
    const { draw_id } = req.params;
    db.all("SELECT * FROM redemptions WHERE draw_id = ?", [draw_id], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  return router;
};
