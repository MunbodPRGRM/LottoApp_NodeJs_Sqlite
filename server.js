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

// ===== API: สมัครสมาชิก =====
app.post("/users/register", async (req, res) => {
  const { email, password, username, role } = req.body;

  if (!email || !password || !username || !role) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const hash = await bcrypt.hash(password, 10);

    db.run(
      `INSERT INTO users (email, password_hash, username, role) VALUES (?, ?, ?, ?)`,
      [email, hash, username, role],
      function (err) {
        if (err) {
          return res.status(400).json({ error: "Email already exists or invalid" });
        }
        res.json({ id: this.lastID, email, username, role });
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ===== API: login =====
app.post("/users/login", (req, res) => {
  const { username, password } = req.body;

  db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      SECRET_KEY,
      { expiresIn: "1h" }
    );

    res.json({ token });
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
