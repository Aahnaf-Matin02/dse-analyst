import fs from "fs";
import path from "path";
import { UserRepository, DatabaseSchema, UserRecord } from "./userRepository";

function resolveUsersDbPath(): string {
  const envPath = process.env.USERS_DB_PATH;
  if (envPath && !envPath.includes("path to your") && !envPath.includes("<") && envPath.endsWith(".json")) {
    return path.isAbsolute(envPath) ? envPath : path.join(process.cwd(), envPath);
  }
  return path.join(process.cwd(), "data", "users_db.json");
}

const USERS_DB_PATH = resolveUsersDbPath();

// In-memory shadow db fallback
let memoryWatchlists: Record<string, string[]> = {};

function loadDb(): DatabaseSchema {
  try {
    if (fs.existsSync(USERS_DB_PATH)) {
      const data = fs.readFileSync(USERS_DB_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    // Fail silently
  }
  return { users: {} };
}

function saveDb(db: DatabaseSchema) {
  try {
    fs.writeFileSync(USERS_DB_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.warn("[WatchlistRepository] Failed to write watchlist changes to disk:", err);
  }
}

export const WatchlistRepository = {
  getWatchlist(email: string): string[] {
    const user = UserRepository.getByEmail(email);
    if (user) {
      return user.watchlist;
    }
    const normalizedEmail = email.toLowerCase().trim();
    return memoryWatchlists[normalizedEmail] || [];
  },

  addToWatchlist(email: string, symbol: string): string[] {
    const sym = symbol.toUpperCase().trim();
    const normalizedEmail = email.toLowerCase().trim();
    
    try {
      const db = loadDb();
      const user = db.users[normalizedEmail];

      if (user) {
        if (!user.watchlist.includes(sym)) {
          user.watchlist.push(sym);
          saveDb(db);
        }
        return user.watchlist;
      }
    } catch {
      // Fallback
    }

    if (!memoryWatchlists[normalizedEmail]) {
      memoryWatchlists[normalizedEmail] = ["GP", "SQURPHARMA"];
    }
    if (!memoryWatchlists[normalizedEmail].includes(sym)) {
      memoryWatchlists[normalizedEmail].push(sym);
    }
    return memoryWatchlists[normalizedEmail];
  },

  removeFromWatchlist(email: string, symbol: string): string[] {
    const sym = symbol.toUpperCase().trim();
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const db = loadDb();
      const user = db.users[normalizedEmail];

      if (user) {
        user.watchlist = user.watchlist.filter(s => s !== sym);
        saveDb(db);
        return user.watchlist;
      }
    } catch {
      // Fallback
    }

    if (!memoryWatchlists[normalizedEmail]) {
      memoryWatchlists[normalizedEmail] = ["GP", "SQURPHARMA"];
    }
    memoryWatchlists[normalizedEmail] = memoryWatchlists[normalizedEmail].filter(s => s !== sym);
    return memoryWatchlists[normalizedEmail];
  }
};
