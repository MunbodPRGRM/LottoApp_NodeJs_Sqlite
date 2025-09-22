// ===== Import Dependencies =====
const express = require("express");        // ใช้สร้าง Web Server (REST API)
const sqlite3 = require("sqlite3").verbose(); // ใช้เชื่อมต่อ SQLite Database
const os = require("os");                  // ใช้ดึงข้อมูลระบบ เช่น IP Address
const bcrypt = require("bcrypt");          // ใช้เข้ารหัสรหัสผ่าน (Hash Password)
const cors = require("cors");


// ===== Import Controllers =====
// แต่ละไฟล์ controller แยกจัดการ route ตามหมวดหมู่
const users = require("./controller/users");
const lotto = require("./controller/lotto");
const draw = require("./controller/draw");
const system = require("./controller/system");
const wallet = require("./controller/wallet");


// ===== สร้าง Express App =====
const app = express();  
const port = process.env.PORT || 3000;       // กำหนด Port ที่จะให้เซิร์ฟเวอร์รัน
const host = "0.0.0.0";  // ให้รันบนทุก IP ของเครื่อง (ไม่จำกัดแค่ localhost)


app.use(cors({
  origin: "*", // หรือใส่ URL ของแอปเฉพาะ
}));


// Middleware สำหรับ parse ข้อมูล JSON และ URL-encoded
app.use(express.json());                       // รองรับ JSON body
app.use(express.urlencoded({ extended: true })); // รองรับ form data


// ===== DB Connect =====
const db = new sqlite3.Database("./lotto_app.db", (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log("Connected to the lotto_app database.");
  }
});


// ===== ฟังก์ชันหา IPv4 ของเครื่อง =====
function getLocalIP() {
  const nets = os.networkInterfaces(); // ดึงข้อมูล network interface ของเครื่อง
  for (const name of Object.keys(nets)) { 
    for (const net of nets[name]) {
      // เลือกเฉพาะ IPv4 ที่ไม่ใช่ internal (เช่น 127.0.0.1)
      if (net.family === "IPv4" && !net.internal) {
        return net.address; // คืนค่าเป็น IP ของเครื่อง
      }
    }
  }
  return "127.0.0.1"; // fallback ถ้าไม่เจอ
}


// ===== Routing (เชื่อม Controller กับ Path) =====
app.use("/users", users(db, bcrypt));
app.use("/lotto", lotto(db));
app.use("/draw", draw(db));
app.use("/system", system(db));
app.use("/wallet", wallet(db));


// ===== Start Server =====
app.listen(port, host, () => {
  const ip = getLocalIP(); // ดึง IP จริงของเครื่องมาโชว์
  console.log(`Lotto API running at http://${ip}:${port}`); // แสดง URL ที่เข้าใช้งานได้
});
