import { Router, Response } from "express";
import crypto from "crypto";
import { UserRepository } from "../repositories/userRepository";
import { activeSessions, authenticateToken, AuthenticatedRequest, saveSessionsToDisk, revokeAllSessionsForUser } from "../middleware/auth";
import { PasswordValidator } from "../services/passwordValidator";
import { MailerService } from "../services/mailer";

const router = Router();

// In-memory rate limiting map for verification resends
const resendCooldowns = new Map<string, number>();

// 1. Email and password formats validation helper
function validateEmail(email: string): boolean {
  return typeof email === "string" && email.includes("@") && email.length > 4;
}

// 2. Signup endpoint with complexity check & HaveIBeenPwned integration
router.post("/signup", async (req, res, next) => {
  try {
    const { email, name, password } = req.body;
    
    if (!email || !name || !password) {
      return res.status(400).json({ error: "Email, name, and password are required parameters." });
    }
    
    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Invalid email format. Must contain @ and be a valid domain." });
    }

    // Complexity check
    const strength = PasswordValidator.validateComplexity(password);
    if (!strength.valid) {
      return res.status(400).json({ error: strength.error });
    }

    // HaveIBeenPwned breach check
    const breached = await PasswordValidator.isBreached(password);
    if (breached) {
      return res.status(400).json({
        error: "This password has been exposed in a public data breach. Please choose a different, unique password."
      });
    }

    const created = UserRepository.createUser(email, name, password);

    // Generate Verification OTP code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = crypto.createHash("sha256").update(verificationCode).digest("hex");
    const codeExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours expiry

    UserRepository.updateUser(created.email, {
      emailVerificationTokenHash: codeHash,
      emailVerificationTokenExpires: codeExpires
    });

    // Send email with verification code
    await MailerService.sendMail({
      to: created.email,
      subject: "Verify your DSE AI Analyst Account",
      text: `Your verification code is: ${verificationCode}. It will expire in 24 hours.`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #2563eb; text-align: center;">Welcome to DSE AI Analyst!</h2>
          <p>Thank you for registering. Please verify your email address to unlock full analytical capabilities:</p>
          <div style="text-align: center; margin: 25px 0;">
            <div style="font-size: 28px; font-weight: bold; padding: 12px 24px; background-color: #f3f4f6; display: inline-block; border-radius: 6px; letter-spacing: 4px; border: 1px dashed #2563eb; color: #1e3a8a;">
              ${verificationCode}
            </div>
          </div>
          <p>This code will expire in 24 hours.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 11px; color: #666; text-align: center;">If you did not sign up for this account, you can safely ignore this email.</p>
        </div>
      `
    });

    // Auto-login upon signing up successfully
    const token = crypto.randomBytes(24).toString("hex");
    activeSessions.set(token, {
      email: created.email,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes longevity
    });
    saveSessionsToDisk();

    res.status(201).json({
      success: true,
      token,
      user: {
        email: created.email,
        name: created.name,
        tier: (created as any).tier || "free",
        subscriptionStatus: (created as any).subscriptionStatus || "active",
        subscriptionExpiresAt: (created as any).subscriptionExpiresAt || "",
        emailVerified: false
      }
    });
  } catch (err: any) {
    if (err.message?.includes("already exists")) {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
});

// 3. Login endpoint with brute-force lockout protection
router.post("/login", (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password parameters are required." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const userRecord = UserRepository.getByEmail(normalizedEmail);

    // If user exists, check lockout
    if (userRecord) {
      if (userRecord.lockoutUntil && new Date(userRecord.lockoutUntil) > new Date()) {
        const timeLeft = Math.ceil((new Date(userRecord.lockoutUntil).getTime() - Date.now()) / 1000 / 60);
        return res.status(403).json({
          error: "ACCOUNT_LOCKED",
          message: `This account has been temporarily locked due to too many failed login attempts. Please try again in ${timeLeft} minute(s).`
        });
      }
    }

    const matched = UserRepository.verifyPassword(email, password);
    
    if (!matched) {
      // Increment login failure for brute-force tracking
      if (userRecord) {
        const { locked, lockoutUntil } = UserRepository.incrementFailedLogin(normalizedEmail);
        if (locked) {
          console.warn(`[SECURITY] Account lockout triggered for user email: ${normalizedEmail}`);
          return res.status(403).json({
            error: "ACCOUNT_LOCKED",
            message: "This account has been temporarily locked due to too many failed login attempts. Please try again in 15 minutes."
          });
        }
      }
      return res.status(401).json({ error: "Invalid email or matching password combination." });
    }

    // Clear failed logins on successful login
    UserRepository.resetFailedLogin(normalizedEmail);

    const token = crypto.randomBytes(24).toString("hex");
    activeSessions.set(token, {
      email: matched.email,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000)
    });
    saveSessionsToDisk();

    res.json({
      success: true,
      token,
      user: {
        email: matched.email,
        name: matched.name,
        tier: userRecord?.tier || "free",
        subscriptionStatus: userRecord?.subscriptionStatus || "active",
        subscriptionExpiresAt: userRecord?.subscriptionExpiresAt || "",
        emailVerified: !!userRecord?.emailVerified
      }
    });
  } catch (err) {
    next(err);
  }
});

// 3.1. Verify Email OTP
router.post("/verify-email", (req, res, next) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: "Email and verification code are required parameters." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = UserRepository.getByEmail(normalizedEmail);

    if (!user) {
      return res.status(400).json({ error: "Invalid verification code or code has expired." });
    }

    if (user.emailVerified) {
      return res.json({ success: true, message: "Email is already verified." });
    }

    if (!user.emailVerificationTokenHash || !user.emailVerificationTokenExpires) {
      return res.status(400).json({ error: "No pending verification request exists for this user." });
    }

    if (new Date(user.emailVerificationTokenExpires) < new Date()) {
      return res.status(400).json({ error: "Verification code has expired. Please request a new one." });
    }

    const hash = crypto.createHash("sha256").update(code.trim()).digest("hex");
    if (hash !== user.emailVerificationTokenHash) {
      return res.status(400).json({ error: "Invalid verification code or code has expired." });
    }

    UserRepository.updateUser(normalizedEmail, {
      emailVerified: true,
      emailVerificationTokenHash: null,
      emailVerificationTokenExpires: null
    });

    res.json({ success: true, message: "Email address verified successfully!" });
  } catch (err) {
    next(err);
  }
});

// 3.2. Resend verification OTP code (with rate limit cooldown)
router.post("/resend-verification", async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email parameter is required." });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 60 seconds cooldown check
    const now = Date.now();
    const lastResend = resendCooldowns.get(normalizedEmail) || 0;
    if (now - lastResend < 60 * 1000) {
      const wait = Math.ceil((60 * 1000 - (now - lastResend)) / 1000);
      return res.status(429).json({
        error: "RATE_LIMITED",
        message: `Please wait ${wait} seconds before requesting a new verification code.`
      });
    }

    const user = UserRepository.getByEmail(normalizedEmail);
    if (!user) {
      // Discreet error to protect user identity
      return res.json({ success: true, message: "If the email is registered, a new verification code has been sent." });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: "This email address is already verified." });
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = crypto.createHash("sha256").update(verificationCode).digest("hex");
    const codeExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    UserRepository.updateUser(normalizedEmail, {
      emailVerificationTokenHash: codeHash,
      emailVerificationTokenExpires: codeExpires
    });

    resendCooldowns.set(normalizedEmail, now);

    await MailerService.sendMail({
      to: user.email,
      subject: "Verify your DSE AI Analyst Account",
      text: `Your verification code is: ${verificationCode}. It will expire in 24 hours.`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #2563eb; text-align: center;">Verify Your Account</h2>
          <p>Please verify your email address to unlock full analytical capabilities on DSE AI Analyst:</p>
          <div style="text-align: center; margin: 25px 0;">
            <div style="font-size: 28px; font-weight: bold; padding: 12px 24px; background-color: #f3f4f6; display: inline-block; border-radius: 6px; letter-spacing: 4px; border: 1px dashed #2563eb; color: #1e3a8a;">
              ${verificationCode}
            </div>
          </div>
          <p>This code will expire in 24 hours.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 11px; color: #666; text-align: center;">If you did not request this, you can safely ignore this email.</p>
        </div>
      `
    });

    res.json({ success: true, message: "If the email is registered, a new verification code has been sent." });
  } catch (err) {
    next(err);
  }
});

// 3.3. Forgot password (issues single-use reset token)
router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email parameter is required." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = UserRepository.getByEmail(normalizedEmail);
    const successMsg = "If the email is registered, a password reset link has been sent.";

    if (!user) {
      return res.json({ success: true, message: successMsg });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    const tokenExpires = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(); // 1 hour

    UserRepository.updateUser(normalizedEmail, {
      passwordResetTokenHash: tokenHash,
      passwordResetTokenExpires: tokenExpires
    });

    const hostHeader = req.headers["x-forwarded-host"] || req.headers["host"] || req.get("host");
    const protoHeader = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const appUrl = process.env.APP_URL || (hostHeader ? `${protoHeader}://${hostHeader}` : "https://dse-analyst.app");
    const resetLink = `${appUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

    await MailerService.sendMail({
      to: user.email,
      subject: "Reset your DSE AI Analyst Password",
      text: `Click the link to reset your password: ${resetLink}. It will expire in 1 hour.`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #ef4444; text-align: center;">Password Reset Request</h2>
          <p>A request was made to reset the password for your DSE AI Analyst account. Click the button below to choose a new password:</p>
          <div style="text-align: center; margin: 25px 0;">
            <a href="${resetLink}" style="display: inline-block; background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Reset Password
            </a>
          </div>
          <p>Or copy and paste this URL into your browser:</p>
          <p style="word-break: break-all; color: #2563eb; font-size: 13px;">${resetLink}</p>
          <p>This single-use reset link will expire in 1 hour.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 11px; color: #666; text-align: center;">If you did not request this, please secure your account immediately if needed.</p>
        </div>
      `
    });

    res.json({ success: true, message: successMsg });
  } catch (err) {
    next(err);
  }
});

// 3.4. Reset password
router.post("/reset-password", async (req, res, next) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: "Email, token, and new password parameters are required." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = UserRepository.getByEmail(normalizedEmail);

    if (!user || !user.passwordResetTokenHash || !user.passwordResetTokenExpires) {
      return res.status(400).json({ error: "Invalid email, expired, or invalid password reset token." });
    }

    if (new Date(user.passwordResetTokenExpires) < new Date()) {
      return res.status(400).json({ error: "The password reset link has expired. Please request a new one." });
    }

    const inputHash = crypto.createHash("sha256").update(token).digest("hex");
    if (inputHash !== user.passwordResetTokenHash) {
      return res.status(400).json({ error: "Invalid email, expired, or invalid password reset token." });
    }

    // Check strength
    const strength = PasswordValidator.validateComplexity(newPassword);
    if (!strength.valid) {
      return res.status(400).json({ error: strength.error });
    }

    // Check breach DB
    const breached = await PasswordValidator.isBreached(newPassword);
    if (breached) {
      return res.status(400).json({
        error: "This password has been exposed in a public data breach. Please choose a different, unique password."
      });
    }

    // Hash the password
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = crypto.pbkdf2Sync(newPassword, salt, 10000, 64, "sha512").toString("hex");

    UserRepository.updateUser(normalizedEmail, {
      passwordHash,
      salt,
      passwordResetTokenHash: null,
      passwordResetTokenExpires: null,
      loginAttempts: 0,
      lockoutUntil: null
    });

    // Terminate all sessions across other devices
    revokeAllSessionsForUser(normalizedEmail);

    res.json({
      success: true,
      message: "Password reset successfully! All other active sessions have been logged out. Please sign in with your new password."
    });
  } catch (err) {
    next(err);
  }
});


// 4. Logout endpoint
router.post("/logout", authenticateToken as any, (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = (authHeader && authHeader.split(" ")[1]) || (req.headers["x-session-token"] as string);

    if (token) {
      activeSessions.delete(token);
      saveSessionsToDisk();
    }

    res.json({ success: true, message: "Logged out from persistent system successfully." });
  } catch (err) {
    next(err);
  }
});

// 5. Query user data self profile info
router.get("/me", authenticateToken as any, (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const email = req.userEmail;
    if (!email) {
      return res.status(401).json({ error: "Session metadata could not be fetched." });
    }

    const user = UserRepository.getByEmail(email);
    if (!user) {
      return res.status(404).json({ error: "User record no longer exists." });
    }

    res.json({
      email: user.email,
      name: user.name,
      watchlist: user.watchlist,
      tier: user.tier || "free",
      subscriptionStatus: user.subscriptionStatus || "active",
      subscriptionExpiresAt: user.subscriptionExpiresAt || ""
    });
  } catch (err) {
    next(err);
  }
});

export const AuthRouter = router;
