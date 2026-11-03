import crypto from "crypto";

// List of top 100 common weak passwords to reject immediately
const COMMON_PASSWORDS = new Set([
  "password", "123456", "12345678", "123456789", "12345", "1234567", "password123",
  "qwerty", "admin", "letmein", "welcome", "football", "monkey", "charlie",
  "bangladesh", "dhaka123", "dse1234", "dseanalyst", "analyst123", "password123!"
]);

export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

export const PasswordValidator = {
  /**
   * Enforces zxcvbn-style complexity rules:
   * - At least 8 characters
   * - Must contain uppercase letter
   * - Must contain lowercase letter
   * - Must contain at least one digit
   * - Must contain at least one special character (e.g. !@#$%^&*)
   * - Must not be a common/weak password
   */
  validateComplexity(password: string): PasswordValidationResult {
    if (typeof password !== "string") {
      return { valid: false, error: "Password must be a valid string." };
    }

    if (password.length < 8) {
      return { valid: false, error: "Password must be at least 8 characters long." };
    }

    if (COMMON_PASSWORDS.has(password.toLowerCase().trim())) {
      return { valid: false, error: "Password is too common and easily guessable. Please choose a stronger password." };
    }

    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    const missing = [];
    if (!hasUppercase) missing.push("uppercase letter");
    if (!hasLowercase) missing.push("lowercase letter");
    if (!hasDigit) missing.push("number");
    if (!hasSpecial) missing.push("special character");

    if (missing.length > 0) {
      return {
        valid: false,
        error: `Password must contain at least one ${missing.join(", ")}.`
      };
    }

    return { valid: true };
  },

  /**
   * Checks the password against HaveIBeenPwned range API using the k-anonymity model.
   * Never transmits the full password or full SHA-1 hash to the API.
   */
  async isBreached(password: string): Promise<boolean> {
    try {
      const sha1 = crypto.createHash("sha1").update(password).digest("hex").toUpperCase();
      const prefix = sha1.slice(0, 5);
      const suffix = sha1.slice(5);

      const url = `https://api.pwnedpasswords.com/range/${prefix}`;
      
      // Use standard fetch (available in Node 18+) with a reasonable timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "DSE-AI-Analyst-App" }
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        // If API is down or rates limited, fail-safe: don't block registration
        console.warn("[BREACH CHECK] HaveIBeenPwned API returned error status:", res.status);
        return false;
      }

      const text = await res.text();
      const lines = text.split("\n");

      for (const line of lines) {
        const [rowSuffix, countStr] = line.trim().split(":");
        if (rowSuffix === suffix) {
          const count = parseInt(countStr || "0", 10);
          if (count > 0) {
            console.warn(`[BREACH CHECK] Password suffix matched in Pwned DB! Seen ${count} times.`);
            return true;
          }
        }
      }

      return false;
    } catch (err) {
      // Fail-open: do not block signups if the network/api is down
      console.error("[BREACH CHECK] Exception occurred during HaveIBeenPwned check:", err);
      return false;
    }
  }
};
