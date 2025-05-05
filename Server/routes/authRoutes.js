const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const {
  signup,
  login,
  verifyEmail,
  resendVerificationCode,
  forgotPassword,
  resetPassword,
  getMe,
  logout,
} = require("../controllers/authController");
const { protect } = require("../middleware/auth");

// Register
router.post(
  "/signup",
  [
    check("email", "Please include a valid email").isEmail(),
    check("password", "Password must be at least 6 characters").isLength({
      min: 6,
    }),
  ],
  signup
);

// Verify email
router.post("/verify", verifyEmail);

// Resend verification code
router.post("/resend", resendVerificationCode);

// Login
router.post(
  "/login",
  [
    check("email", "Please include a valid email").isEmail(),
    check("password", "Password is required").exists(),
  ],
  login
);

// Forgot password
router.post("/forgot-password", forgotPassword);

// Reset password
router.post(
  "/reset-password",
  [
    check("password", "Password must be at least 6 characters").isLength({
      min: 6,
    }),
  ],
  resetPassword
);

// Get current user
router.get("/me", protect, getMe);

// Logout
router.get("/logout", protect, logout);

module.exports = router;
