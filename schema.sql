-- ================================
-- USERS
-- ================================
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    username TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('member', 'owner'))
);

-- ================================
-- WALLETS
-- ================================
CREATE TABLE wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    balance REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ================================
-- LOTTERY NUMBERS
-- ================================
CREATE TABLE lottery_numbers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT NOT NULL UNIQUE,
    price REAL NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('available', 'sold', 'redeemed')),
    user_id INTEGER, -- ใครเป็นเจ้าของเลข (NULL = ยังไม่ขาย)
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ================================
-- DRAWS (งวดการออกรางวัล)
-- ================================
CREATE TABLE draws (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mode TEXT NOT NULL CHECK(mode IN ('sold_only', 'all_numbers'))
);

-- ================================
-- PRIZES (ผลรางวัลในแต่ละงวด)
-- ================================
CREATE TABLE prizes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    draw_id INTEGER NOT NULL,
    prize_rank INTEGER NOT NULL CHECK(prize_rank BETWEEN 1 AND 5),
    prize_number TEXT NOT NULL,
    prize_amount REAL NOT NULL,
    FOREIGN KEY (draw_id) REFERENCES draws(id) ON DELETE CASCADE
);

-- ================================
-- REDEMPTIONS (การขึ้นเงิน)
-- ================================
CREATE TABLE redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lottery_id INTEGER NOT NULL,   -- ลอตเตอรี่ที่ถูกขึ้นเงิน
    draw_id INTEGER NOT NULL,      -- อ้างอิงงวด
    prize_rank INTEGER NOT NULL CHECK(prize_rank BETWEEN 1 AND 5),
    prize_amount REAL NOT NULL,
    FOREIGN KEY (lottery_id) REFERENCES lottery_numbers(id) ON DELETE CASCADE,
    FOREIGN KEY (draw_id) REFERENCES draws(id) ON DELETE CASCADE
);
