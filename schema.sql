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
-- WALLET TRANSACTIONS
-- ================================
CREATE TABLE wallettransactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('credit', 'debit')),
    amount REAL NOT NULL,
    ref_type TEXT,
    ref_id INTEGER,
    FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
);

-- ================================
-- LOTTERY NUMBERS
-- ================================
CREATE TABLE lotterynumbers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT NOT NULL UNIQUE,
    price REAL NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('available', 'sold'))
);

-- ================================
-- TICKETS
-- ================================
CREATE TABLE tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    lotto_id INTEGER NOT NULL,
    purchase_price REAL NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('active', 'redeemed', 'expired')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (lotto_id) REFERENCES lotterynumbers(id) ON DELETE CASCADE
);

-- ================================
-- DRAWS
-- ================================
CREATE TABLE draws (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mode TEXT NOT NULL CHECK(mode IN ('sold_only', 'all_numbers')),
    prize1_num TEXT,
    prize2_num TEXT,
    prize3_num TEXT,
    prize4_num TEXT,
    prize5_num TEXT,
    prize1_amt REAL DEFAULT 0,
    prize2_amt REAL DEFAULT 0,
    prize3_amt REAL DEFAULT 0,
    prize4_amt REAL DEFAULT 0,
    prize5_amt REAL DEFAULT 0
);

-- ================================
-- REDEMPTIONS
-- ================================
CREATE TABLE redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    draw_id INTEGER NOT NULL,
    prize_tier INTEGER NOT NULL,
    prize_amount REAL NOT NULL,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (draw_id) REFERENCES draws(id) ON DELETE CASCADE
);
