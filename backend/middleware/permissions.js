/**
 * Admin can restrict which tools/pages a given account may use (permissions.allowedTools).
 * - admin: always full access, never restricted.
 * - Any account with allowedTools === null/undefined: unrestricted (default, backward compatible).
 * - Any account with allowedTools as an array: restricted to exactly that list.
 */
function requireTool(toolId) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Chưa đăng nhập.' });
    if (req.user.role === 'admin') return next();
    const allowed = req.user.security && Array.isArray(req.user.security.allowedTools) ? req.user.security.allowedTools : null;
    if (allowed && !allowed.includes(toolId)) {
      return res.status(403).json({ error: `Tài khoản của bạn không được cấp quyền sử dụng công cụ "${toolId}". Liên hệ Admin.` });
    }
    next();
  };
}

module.exports = { requireTool };
