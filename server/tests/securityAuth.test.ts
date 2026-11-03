import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { PasswordValidator } from "../services/passwordValidator";
import { UserRepository } from "../repositories/userRepository";
import crypto from "crypto";

describe("Tier 1: Security & Account Integrity Test Suite", () => {
  describe("Password Validator - Complexity Enforcement", () => {
    it("should reject passwords that are too short (< 8 characters)", () => {
      const result = PasswordValidator.validateComplexity("Short1!");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("at least 8 characters");
    });

    it("should reject common weak passwords", () => {
      const result = PasswordValidator.validateComplexity("password123!");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too common");
    });

    it("should reject passwords lacking uppercase characters", () => {
      const result = PasswordValidator.validateComplexity("lowercase123!");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must contain at least one uppercase letter");
    });

    it("should reject passwords lacking lowercase characters", () => {
      const result = PasswordValidator.validateComplexity("UPPERCASE123!");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must contain at least one lowercase letter");
    });

    it("should reject passwords lacking digits", () => {
      const result = PasswordValidator.validateComplexity("NoDigitsHere!");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must contain at least one number");
    });

    it("should reject passwords lacking special characters", () => {
      const result = PasswordValidator.validateComplexity("NoSpecialChars123");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must contain at least one special character");
    });

    it("should successfully accept a highly secure robust password", () => {
      const result = PasswordValidator.validateComplexity("DseAIAnalyst#2026");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe("Password Validator - HaveIBeenPwned Range K-Anonymity Integration", () => {
    it("should return false (secure) for a unique generated complex password", async () => {
      const uniquePass = "Xy7$_pQ1!mZ9_" + crypto.randomBytes(8).toString("hex");
      const isBreached = await PasswordValidator.isBreached(uniquePass);
      expect(isBreached).toBe(false);
    });

    it("should gracefully handle fetch timeouts or server offline fail-safes without crashing", async () => {
      // Mock global fetch temporarily to simulate a server/network error
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error("Network connection timeout"));

      const isBreached = await PasswordValidator.isBreached("password");
      expect(isBreached).toBe(false); // Should fail-open and not block

      global.fetch = originalFetch;
    });
  });

  describe("Brute Force & Lockout System", () => {
    const testEmail = "lockout-test@example.com";

    beforeAll(() => {
      // Seed a test user
      try {
        UserRepository.createUser(testEmail, "Lockout Test", "SecurePass123!");
      } catch (e) {
        // User might already exist
      }
    });

    afterAll(() => {
      // Clean up the user in UserRepository if needed
      UserRepository.updateUser(testEmail, {
        loginAttempts: 0,
        lockoutUntil: null
      });
    });

    it("should track failed login attempts and trigger lockout after 5 failures", () => {
      // Reset first
      UserRepository.resetFailedLogin(testEmail);
      const initial = UserRepository.getByEmail(testEmail);
      expect(initial?.loginAttempts).toBe(0);
      expect(initial?.lockoutUntil).toBeNull();

      // Increment 4 times
      for (let i = 0; i < 4; i++) {
        const status = UserRepository.incrementFailedLogin(testEmail);
        expect(status.locked).toBe(false);
      }

      const postFour = UserRepository.getByEmail(testEmail);
      expect(postFour?.loginAttempts).toBe(4);
      expect(postFour?.lockoutUntil).toBeNull();

      // 5th attempt locks the account
      const finalStatus = UserRepository.incrementFailedLogin(testEmail);
      expect(finalStatus.locked).toBe(true);
      expect(finalStatus.lockoutUntil).toBeDefined();

      const postFive = UserRepository.getByEmail(testEmail);
      expect(postFive?.loginAttempts).toBe(5);
      expect(postFive?.lockoutUntil).not.toBeNull();

      // Resetting should clear attempts and lockout window
      UserRepository.resetFailedLogin(testEmail);
      const postReset = UserRepository.getByEmail(testEmail);
      expect(postReset?.loginAttempts).toBe(0);
      expect(postReset?.lockoutUntil).toBeNull();
    });
  });
});
