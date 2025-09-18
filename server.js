const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const os = require("os");
const bcrypt = require("bcrypt");

const users = require("./controller/users");
const lotto = require("./controller/lotto");
const draw = require("./controller/draw");
const system = require("./controller/system");
const wallet = require("./controller/wallet");

const app = express();
const port = 3000;
const host = "0.0.0.0";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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


// รวม "/users" ไว้ที่ controller
app.use("/users", users(db, bcrypt));
app.use("/lotto", lotto(db));
app.use("/draw", draw(db));
app.use("/system", system(db));
app.use("/wallet", wallet(db));

// ===== Start Server =====
app.listen(port, host, () => {
  const ip = getLocalIP();
  console.log(`Lotto API running at http://${ip}:${port}`);
});