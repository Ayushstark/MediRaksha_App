// ── Role-based authorization middleware ───────────────────────────────────────
//
// Current implementation: role is read from the User.role column (via JWT).
// Fallback: ADMIN_USER_IDS env var whitelist grants SUPER_ADMIN to listed user IDs.
//
// When the role system is ready, authController.js should embed `role` in the JWT
// payload and this middleware will read req.user.role automatically.

export const ROLES = Object.freeze({
  USER:              'USER',
  HOSPITAL_ADMIN:    'HOSPITAL_ADMIN',
  OPERATIONS_TEAM:   'OPERATIONS_TEAM',
  SUPER_ADMIN:       'SUPER_ADMIN',
});

// Numeric rank — higher number = more authority
const ROLE_RANK = {
  USER:              1,
  HOSPITAL_ADMIN:    3,
  OPERATIONS_TEAM:   4,
  SUPER_ADMIN:       5,
};

// Read whitelist fresh on every call so env changes (e.g. ADMIN_USER_IDS patched
// while the server is running) take effect without a restart.
const resolveRole = (req) => {
  const whitelist = new Set(
    (process.env.ADMIN_USER_IDS || '')
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n))
  );
  if (whitelist.has(req.user?.id)) return ROLES.SUPER_ADMIN;
  return req.user?.role ?? ROLES.USER;
};

// requireRole('OPERATIONS_TEAM') — user must have this role or above
export const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user?.id) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const userRole  = resolveRole(req);
  const userRank  = ROLE_RANK[userRole] ?? 0;
  const minRank   = Math.min(...allowedRoles.map(r => ROLE_RANK[r] ?? 99));

  if (userRank < minRank) {
    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions for this action',
      required_roles: allowedRoles,
    });
  }

  next();
};
