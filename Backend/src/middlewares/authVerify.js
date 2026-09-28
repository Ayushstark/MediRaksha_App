import jwt from "jsonwebtoken";

// Middleware to verify JWT
const authVerify = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  let token = null;

  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "No token provided",
    });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("JWT_SECRET is not configured in environment variables.");
    return res.status(500).json({
      success: false,
      message: "Internal authentication configuration error.",
    });
  }

  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

/**
 * Ensures the authenticated user has a doctor role.
 */
export const doctorVerify = (req, res, next) => {
  if (!req.user?.id) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  if (req.user.role && req.user.role !== "doctor") {
    return res.status(403).json({
      success: false,
      message: "Access denied: Doctor privileges required.",
    });
  }

  next();
};

/**
 * Ensures the authenticated user has a patient/user role.
 */
export const userVerify = (req, res, next) => {
  if (!req.user?.id) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  if (req.user.role && req.user.role !== "user") {
    return res.status(403).json({
      success: false,
      message: "Access denied: Patient account required.",
    });
  }

  next();
};

export default authVerify;