import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import {
  validatePassword,
  validateEmail,
  validateUserSignup,
  validateDoctorSignup,
} from "../utils/security.js";

// Generate JWT with user/doctor ID and role
const generateToken = (id, role = "user") => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not configured.");
  }

  return jwt.sign({ id, role }, secret, {
    expiresIn: "7d",
  });
};

// Cookie options
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// SIGNUP
export const signup = async (req, res) => {
  try {
    const validation = validateUserSignup(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    const { name, email, age, gender, number, password } = validation.sanitizedData;

    // Check existing user
    const existingUser = await pool.query(
      'SELECT id FROM "User" WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    // Hash password with 10 salt rounds
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const newUser = await pool.query(
      `INSERT INTO "User"
      (name, email, age, gender, number, password)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, email, age, gender, number, created_at`,
      [name, email, age, gender, number, hashedPassword]
    );

    const user = newUser.rows[0];

    // Generate token with role
    const token = generateToken(user.id, "user");
    res.cookie("token", token, cookieOptions);

    return res.status(201).json({
      success: true,
      message: "Signup successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: "user",
      },
    });
  } catch (error) {
    console.error("User signup error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during registration.",
    });
  }
};

// LOGIN
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const emailCheck = validateEmail(email);
    if (!emailCheck.isValid) {
      return res.status(400).json({
        success: false,
        message: emailCheck.message,
      });
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.isValid) {
      return res.status(400).json({
        success: false,
        message: passwordCheck.message,
      });
    }

    // Find user
    const result = await pool.query(
      'SELECT id, name, email, password FROM "User" WHERE LOWER(email) = LOWER($1)',
      [emailCheck.normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = result.rows[0];

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Generate token with role
    const token = generateToken(user.id, "user");
    res.cookie("token", token, cookieOptions);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: "user",
      },
    });
  } catch (error) {
    console.error("User login error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during login.",
    });
  }
};

// DOCTOR SIGNUP
export const doctorSignup = async (req, res) => {
  try {
    const validation = validateDoctorSignup(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    const {
      name,
      email,
      number,
      age,
      gender,
      hospital,
      speciality,
      password,
    } = validation.sanitizedData;

    // Check existing doctor
    const existingDoctor = await pool.query(
      'SELECT id FROM "Doctor" WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (existingDoctor.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert doctor
    const newDoctor = await pool.query(
      `INSERT INTO "Doctor"
      (name, email, number, age, gender, hospital, speciality, password)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, name, email, number, age, gender, hospital, speciality, created_at`,
      [name, email, number, age, gender, hospital, speciality, hashedPassword]
    );

    const doctor = newDoctor.rows[0];

    // Generate token with doctor role
    const token = generateToken(doctor.id, "doctor");
    res.cookie("token", token, cookieOptions);

    return res.status(201).json({
      success: true,
      message: "Doctor signup successful",
      token,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
        number: doctor.number,
        age: doctor.age,
        gender: doctor.gender,
        hospital: doctor.hospital,
        speciality: doctor.speciality,
        role: "doctor",
      },
    });
  } catch (error) {
    console.error("Doctor signup error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during doctor registration.",
    });
  }
};

// DOCTOR LOGIN
export const doctorLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const emailCheck = validateEmail(email);
    if (!emailCheck.isValid) {
      return res.status(400).json({
        success: false,
        message: emailCheck.message,
      });
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.isValid) {
      return res.status(400).json({
        success: false,
        message: passwordCheck.message,
      });
    }

    // Find doctor
    const result = await pool.query(
      'SELECT id, name, email, number, age, gender, hospital, speciality, password FROM "Doctor" WHERE LOWER(email) = LOWER($1)',
      [emailCheck.normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const doctor = result.rows[0];

    // Compare password
    const isMatch = await bcrypt.compare(password, doctor.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Generate token with doctor role
    const token = generateToken(doctor.id, "doctor");
    res.cookie("token", token, cookieOptions);

    return res.status(200).json({
      success: true,
      message: "Doctor login successful",
      token,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
        number: doctor.number,
        age: doctor.age,
        gender: doctor.gender,
        hospital: doctor.hospital,
        speciality: doctor.speciality,
        role: "doctor",
      },
    });
  } catch (error) {
    console.error("Doctor login error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during doctor login.",
    });
  }
};

// LOGOUT
export const logout = (req, res) => {
  res.clearCookie("token", cookieOptions);
  return res.status(200).json({
    success: true,
    message: "Logout successful",
  });
};