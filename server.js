const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const os = require("os");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
const port = 3000;
const host = "0.0.0.0";
const SECRET_KEY = "supersecretkey"; // ควรย้ายไปเก็บ .env

app.use(express.json());

// ===== DB Connect =====
const db = new sqlite3.Database("./lotto_app.db", (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log("Connected to the lotto_app database.");
  }
});

// ===== ฟังก์ชันหา IPv4 =====
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}

// ===== API: สมัครสมาชิก (User) =====
const saltRounds = 10;

app.post("/users/register", async (req, res) => {
  const { username, email, password, role } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  // hash password
  const password_hash = await bcrypt.hash(password, saltRounds);

  // insert user
  db.run(
    "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'member')",
    [username, email, password_hash, role],
    function (err) {
      if (err) return res.status(500).json({ error: "Failed to create user" });

      const userId = this.lastID;

      // สร้าง wallet สำหรับ user ใหม่
      db.run(
        "INSERT INTO wallets (user_id, balance) VALUES (?, ?)",
        [userId, 500],
        function (err) {
          if (err) return res.status(500).json({ error: "Failed to create wallet" });

          res.json({
            message: "User registered successfully",
            user: {
              id: userId,
              username,
              email,
              role,
            },
            wallet: {
              id: this.lastID,
              balance: 500,
            },
          });
        }
      );
    }
  );
});

// ===== API: สมัครสมาชิก (Admin) =====

app.post("/users/register/owner", async (req, res) => {
  const { username, email, password, role } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  // hash password
  const password_hash = await bcrypt.hash(password, saltRounds);

  // insert user admin
  db.run(
    "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'owner')",
    [username, email, password_hash, role],
    function (err) {
      if (err) return res.status(500).json({ error: "Failed to create user" });

      const userId = this.lastID;

      // สร้าง wallet สำหรับ admin ใหม่
      db.run(
        "INSERT INTO wallets (user_id, balance) VALUES (?, ?)",
        [userId, 500],
        function (err) {
          if (err) return res.status(500).json({ error: "Failed to create wallet" });

          res.json({
            message: "Admin registered successfully",
            user: {
              id: userId,
              username,
              email,
              role,
            },
            wallet: {
              id: this.lastID,
              balance: 500,
            },
          });
        }
      );
    }
  );
});

// ===== API: login =====
app.post("/users/login", (req, res) => {
  const { username, password } = req.body;

  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
    if (err || !user) return res.status(401).json({ error: "Invalid username or password" });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: "Invalid username or password" });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      SECRET_KEY,
      { expiresIn: "1h" }
    );

    // ดึง wallet ของ user
    db.get("SELECT * FROM wallets WHERE user_id = ?", [user.id], (err, wallet) => {
      if (err) return res.status(500).json({ error: "Failed to get wallet" });

      res.json({
        message: "Login successful",
        token: token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
        wallet: wallet
          ? { id: wallet.id, balance: wallet.balance }
          : { id: null, balance: 0 },
      });
    });
  });
});

// ===== API: ดึงข้อมูล user ทั้งหมด =====
app.get("/users", (req, res) => {
  db.all("SELECT id, email, username, role FROM users", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// ===== Start Server =====
app.listen(port, host, () => {
  const ip = getLocalIP();
  console.log(`Lotto API running at http://${ip}:${port}`);
});
