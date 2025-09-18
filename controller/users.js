const express = require("express");

module.exports = (db, bcrypt) => {
  const router = express.Router();
  const saltRounds = 10;

  // ===== สมัครสมาชิก (Member) =====
  router.post("/register", async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    try {
      const password_hash = await bcrypt.hash(password, saltRounds);

      db.run(
        "INSERT INTO users (email, password_hash, username, role) VALUES (?, ?, ?, 'member')",
        [email, password_hash, username],
        function (err) {
          if (err) {
            if (err.message.includes("UNIQUE constraint failed")) {
              return res.status(400).json({ error: "อีเมลนี้มีผู้ใช้งานแล้ว" });
            }
            return res.status(500).json({ error: "Failed to create user" });
          }

          const userId = this.lastID;

          // สร้าง wallet ให้ user
          db.run(
            "INSERT INTO wallets (user_id, balance) VALUES (?, ?)",
            [userId, 500],
            function (err) {
              if (err) return res.status(500).json({ error: "Failed to create wallet" });

              res.json({
                message: "User registered successfully",
                user: { id: userId, username, email, role: "member" },
                wallet: { id: this.lastID, balance: 500 },
              });
            }
          );
        }
      );
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===== สมัครสมาชิก (Owner/Admin) =====
  router.post("/register/owner", async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    try {
      const password_hash = await bcrypt.hash(password, saltRounds);

      db.run(
        "INSERT INTO users (email, password_hash, username, role) VALUES (?, ?, ?, 'owner')",
        [email, password_hash, username],
        function (err) {
          if (err) {
            if (err.message.includes("UNIQUE constraint failed")) {
              return res.status(400).json({ error: "อีเมลนี้มีผู้ใช้งานแล้ว" });
            }
            return res.status(500).json({ error: "Failed to create user" });
          }

          const userId = this.lastID;

          // สร้าง wallet ให้ owner
          db.run(
            "INSERT INTO wallets (user_id, balance) VALUES (?, ?)",
            [userId, 500],
            function (err) {
              if (err) return res.status(500).json({ error: "Failed to create wallet" });

              res.json({
                message: "Owner registered successfully",
                user: { id: userId, username, email, role: "owner" },
                wallet: { id: this.lastID, balance: 500 },
              });
            }
          );
        }
      );
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===== login =====
  router.post("/login", (req, res) => {
    const { username, password } = req.body; // เปลี่ยนจาก email เป็น username

    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
      if (err || !user) return res.status(401).json({ error: "Invalid username or password" });

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return res.status(401).json({ error: "Invalid username or password" });

      db.get("SELECT * FROM wallets WHERE user_id = ?", [user.id], (err, wallet) => {
        if (err) return res.status(500).json({ error: "Failed to get wallet" });

        res.json({
          message: "Login successful",
          user: { id: user.id, username: user.username, email: user.email, role: user.role },
          wallet: wallet ? { id: wallet.id, balance: wallet.balance } : { id: null, balance: 0 },
        });
      });
    });
  });

  router.post("/reset-password", async (req, res) => {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword)
      return res.status(400).json({ error: "All fields are required" });

    if (password !== confirmPassword)
      return res.status(400).json({ error: "Passwords do not match" });

    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(404).json({ error: "Email not found" });

      try {
        // hash รหัสผ่านใหม่
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        db.run(
          "UPDATE users SET password_hash = ? WHERE id = ?",
          [hashedPassword, user.id],
          (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Password reset successful" });
          }
        );
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });
  });

  // ===== ดึง user ทั้งหมด =====
  router.get("/", (req, res) => {
    db.all("SELECT id, email, username, role FROM users", [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  return router;
};
