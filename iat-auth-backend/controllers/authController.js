// controllers/authController.js

const User = require("../models/User");
const bcrypt = require("bcryptjs");
const sendEmail = require("../utils/sendEmail");

exports.signup = async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // 2. Hash the password (10 = salt rounds)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Generate a 6-digit OTP and set expiry to 10 minutes
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins from now

    // 4. Create and save new user
    const newUser = new User({
      email,
      password: hashedPassword,
      otp,
      otpExpiry,
      isVerified: false,
    });

    await newUser.save();

    // 5. Send OTP to user's email
    await sendEmail(email, otp);

    res
      .status(201)
      .json({
        message: "Signup successful. Please check your email for the OTP.",
      });
  } catch (err) {
    console.error("Signup error:", err.message);
    res.status(500).json({ message: "Server error. Try again later." });
  }
};
