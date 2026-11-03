import fs from "fs";
import path from "path";
import crypto from "crypto";

let DB_FILE_PATH: string;
try {
  const sandboxDir = "/home/aistudio/data";
  if (fs.existsSync("/home/aistudio") || fs.existsSync(sandboxDir)) {
    if (!fs.existsSync(sandboxDir)) {
      fs.mkdirSync(sandboxDir, { recursive: true });
    }
    DB_FILE_PATH = path.join(sandboxDir, "users_db.json");
    
    // Seed from local template if the file doesn't exist in the home volume yet
    if (!fs.existsSync(DB_FILE_PATH)) {
      const templatePath = path.join(process.cwd(), "src", "data", "users_db.json");
      if (fs.existsSync(templatePath)) {
        fs.copyFileSync(templatePath, DB_FILE_PATH);
      } else {
        fs.writeFileSync(DB_FILE_PATH, JSON.stringify({ users: {} }, null, 2), "utf-8");
      }
    }
  } else {
    DB_FILE_PATH = path.join(process.cwd(), "src", "data", "users_db.json");
  }
} catch (e) {
  console.warn("DB sandbox path resolution failed, falling back to repository workspace path:", e);
  DB_FILE_PATH = path.join(process.cwd(), "src", "data", "users_db.json");
}

interface UserRecord {
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
  watchlist: string[];
}

interface DatabaseSchema {
  users: Record<string, UserRecord>;
}

// Ensure database file exists
function ensureDb() {
  const dir = path.dirname(DB_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE_PATH)) {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify({ users: {} }, null, 2), "utf-8");
  }
}

function loadDb(): DatabaseSchema {
  try {
    ensureDb();
    const data = fs.readFileSync(DB_FILE_PATH, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Failed to load user database, resetting...", err);
    return { users: {} };
  }
}

function saveDb(db: DatabaseSchema) {
  try {
    ensureDb();
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save user database", err);
  }
}

// Generate secure salt and PBKDF2 hash
function hashPassword(password: string, salt?: string) {
  const userSalt = salt || crypto.randomBytes(16).toString("hex");
  // Use PBKDF2 with 10,000 iterations, 64 bytes key length, sha512 digest
  const hash = crypto.pbkdf2Sync(password, userSalt, 10000, 64, "sha512").toString("hex");
  return { salt: userSalt, hash };
}

export function getUser(email: string) {
  const db = loadDb();
  const normalizedEmail = email.toLowerCase().trim();
  return db.users[normalizedEmail] || null;
}

export function createUser(email: string, name: string, passwordPlain: string) {
  const db = loadDb();
  const normalizedEmail = email.toLowerCase().trim();

  if (db.users[normalizedEmail]) {
    throw new Error("User with this email already exists");
  }

  const { salt, hash } = hashPassword(passwordPlain);
  
  const newUser: UserRecord = {
    email: normalizedEmail,
    name: name.trim(),
    passwordHash: hash,
    salt,
    watchlist: ["GP", "SQURPHARMA"], // default seed watchlist
  };

  db.users[normalizedEmail] = newUser;
  saveDb(db);
  return { email: newUser.email, name: newUser.name };
}

export function verifyPassword(email: string, passwordPlain: string) {
  const user = getUser(email);
  if (!user) return null;

  const { hash } = hashPassword(passwordPlain, user.salt);
  if (hash === user.passwordHash) {
    return { email: user.email, name: user.name };
  }
  return null;
}

export function getWatchlist(email: string): string[] {
  const user = getUser(email);
  return user ? user.watchlist : [];
}

export function addToWatchlist(email: string, symbol: string): string[] {
  const db = loadDb();
  const normalizedEmail = email.toLowerCase().trim();
  const user = db.users[normalizedEmail];
  
  if (!user) throw new Error("User not found");

  const sym = symbol.toUpperCase().trim();
  if (!user.watchlist.includes(sym)) {
    user.watchlist.push(sym);
    saveDb(db);
  }
  return user.watchlist;
}

export function removeFromWatchlist(email: string, symbol: string): string[] {
  const db = loadDb();
  const normalizedEmail = email.toLowerCase().trim();
  const user = db.users[normalizedEmail];
  
  if (!user) throw new Error("User not found");

  const sym = symbol.toUpperCase().trim();
  user.watchlist = user.watchlist.filter(s => s !== sym);
  saveDb(db);
  return user.watchlist;
}
