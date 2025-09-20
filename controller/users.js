const express = require("express");

module.exports = (db, bcrypt) => {
  const router = express.Router();  // ใช้ Express Router จัดการ endpoint
  const saltRounds = 10;            // จำนวนรอบการ hash password

  // ===== สมัครสมาชิก (Member) =====
  router.post("/register", async (req, res) => {
    const { username, email, password } = req.body;

    // ตรวจสอบว่าข้อมูลครบหรือไม่
    if (!username || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    try {
      // แปลงรหัสผ่านเป็น hash
      const password_hash = await bcrypt.hash(password, saltRounds);

      // เพิ่มข้อมูล user ลงในตาราง users
      db.run(
        "INSERT INTO users (email, password_hash, username, role) VALUES (?, ?, ?, 'member')",
        [email, password_hash, username],
        function (err) {
          if (err) {
            // ถ้า email ซ้ำ จะเจอ UNIQUE constraint failed
            if (err.message.includes("UNIQUE constraint failed")) {
              return res.status(400).json({ error: "อีเมลนี้มีผู้ใช้งานแล้ว" });
            }
            return res.status(500).json({ error: "Failed to create user" });
          }

          const userId = this.lastID; // ดึง ID ของ user ที่เพิ่ง insert

          // สร้าง wallet เริ่มต้นให้ user
          db.run(
            "INSERT INTO wallets (user_id, balance) VALUES (?, ?)",
            [userId, 500],
            function (err) {
              if (err) return res.status(500).json({ error: "Failed to create wallet" });

              // ส่ง response กลับไป พร้อมข้อมูล user + wallet
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

    // ตรวจสอบว่าข้อมูลครบหรือไม่
    if (!username || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    try {
      const password_hash = await bcrypt.hash(password, saltRounds);

      // เพิ่มข้อมูล user role = owner
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

          // ✅ สร้าง wallet เริ่มต้นให้ owner
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
    const { username, password } = req.body; // ใช้ username login

    // ค้นหาผู้ใช้จาก username
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
      if (err || !user) return res.status(401).json({ error: "Invalid username or password" });

      // ตรวจสอบรหัสผ่านว่าถูกต้องหรือไม่
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return res.status(401).json({ error: "Invalid username or password" });

      // ดึงข้อมูล wallet ของ user มาด้วย
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

  // ===== Reset Password =====
  router.post("/reset-password", async (req, res) => {
    const { name, email, password, confirmPassword } = req.body;

    // ตรวจสอบว่าใส่ข้อมูลครบ
    if (!name || !email || !password || !confirmPassword)
      return res.status(400).json({ error: "All fields are required" });

    // ตรวจสอบว่า password และ confirmPassword ตรงกัน
    if (password !== confirmPassword)
      return res.status(400).json({ error: "Passwords do not match" });

    // ตรวจสอบว่า user มีอยู่จริงจาก email
    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(404).json({ error: "Email not found" });

      try {
        // hash รหัสผ่านใหม่
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // update password ของ user
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
    // ดึงเฉพาะ field ที่จำเป็น
    db.all("SELECT id, email, username, role FROM users", [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  return router; // ส่ง router ออกไปใช้งานที่ server.js
};
