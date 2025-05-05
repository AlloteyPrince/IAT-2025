const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { sendEmail } = require('../utils/emailService');
const { validationResult } = require('express-validator');

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Register user
// @route   POST /api/auth/signup
// @access  Public
exports.signup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    // Check if user exists
    let user = await User.findOne({ email });

    if (user) {
      return res.status(400).json({
        success: false,
        message: 'User already exists',
      });
    }

    // Generate verification code
    const verificationCode = generateOTP();
    const verificationExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Create user
    user = await User.create({
      email,
      password,
      verificationCode,
      verificationExpires,
    });

    // Send verification email
    const message = `
      Email Verification
      Thank you for registering with IAT. Please verify your email address with the code below:
      ${verificationCode}
      This code will expire in 10 minutes.
    `;

    await sendEmail({
      email: user.email,
      subject: 'IAT - Email Verification',
      message,
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email for verification code.',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
};

// @desc    Verify user email
// @route   POST /api/auth/verify
// @access  Public
exports.verifyEmail = async (req, res) => {
  const { email, otp } = req.body;

  try {
    // Find user
    const user = await User.findOne({
      email,
      verificationCode: otp,
      verificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code',
      });
    }

    // Update user
    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Email verified successfully. You can now login.',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
};

// @desc    Resend verification code
// @route   POST /api/auth/resend
// @access  Public
exports.resendVerificationCode = async (req, res) => {
  const { email } = req.body;

  try {
    // Find user
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified',
      });
    }

    // Generate new verification code
    const verificationCode = generateOTP();
    const verificationExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Update user
    user.verificationCode = verificationCode;
    user.verificationExpires = verificationExpires;
    await user.save();

    // Send verification email
    const message = `
      Email Verification
      Please verify your email address with the code below:
      ${verificationCode}
      This code will expire in 10 minutes.
    `;

    await sendEmail({
      email: user.email,
      subject: 'IAT - Email Verification Code',
      message,
    });

    res.status(200).json({
      success: true,
      message: 'Verification code sent successfully',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    // Check if user exists
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(401).json({
        success: false,
        message: 'Please verify your email first',
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Generate reset token
    const resetCode = generateOTP();
    const resetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Update user
    user.resetPasswordToken = resetCode;
    user.resetPasswordExpire = resetExpires;
    await user.save();

    // Send reset email
    const message = `
      Password Reset
      You are receiving this email because you (or someone else) has requested the reset of a password.
      Your password reset code is:
      ${resetCode}
      This code will expire in 10 minutes.
    `;

    await sendEmail({
      email: user.email,
      subject: 'IAT - Password Reset',
      message,
    });

    res.status(200).json({
      success: true,
      message: 'Password reset email sent',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
  const { email, resetCode, password } = req.body;

  try {
    const user = await User.findOne({
      email,
      resetPasswordToken: resetCode,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset code',
      });
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
};


// @desc    Logout user

exports.logout = async (req, res) => {
  try {
    res.cookie('token', '', {
      expires: new Date(Date.now()),
      httpOnly: true,
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
};



