const jwt = require('jsonwebtoken');
const EnvController = require('../controllers/EnvController');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const EXAM_DURATION_SECONDS = parseInt(process.env.EXAM_DURATION_SECONDS);

// NEW: server‑side IP extraction & normalization (no client supplied IP trusted)
function getClientIp(req) {
  let ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') ip = '127.0.0.1';
  return ip;
}

// unchanged
const respondError = (res, status, message, reason) => {
  return res.status(status).json({
    success: false,
    message,
    reason,
    showPopup: true,
    popupDuration: 10
  });
};

const handleLogin = async (req, res) => {
  const { studentId, password } = req.body;        // REMOVED ip from body
  try {
    const studentsData = await EnvController.loadConfig('students');
    const globalPassword = studentsData.password;
    const student = studentsData.students.find(s => s.studentId === studentId);

    if (!studentId || !password)
      return respondError(res, 400, 'Student ID and password are required', 'missingStudentId');
    if (!student)
      return respondError(res, 404, 'Student not found', 'studentNotFound');
    if (password !== globalPassword)
      return respondError(res, 403, 'Invalid credentials', 'invalidCredentials');

    // Derive IP server-side (NOT encoded inside token)
    const clientIp = getClientIp(req);

    // JWT now ONLY contains studentId
    const token = jwt.sign(
      { studentId },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    const updatedStudent = {
      ...student,
      lastLogin: new Date().toISOString(),
      examStartTime: student.examStartTime || new Date().toISOString(),
      authToken: token,
      lastIp: student.currentIp || clientIp,
      currentIp: clientIp,
      tokenExpiry: new Date(Date.now() + 7200000).toISOString()
    };

    const updatedStudents = studentsData.students.map(s =>
      s.studentId === studentId ? updatedStudent : s
    );

    const activeConfig = EnvController.getActiveConfigs();
    await EnvController.createConfig(activeConfig.students, {
      ...studentsData,
      students: updatedStudents
    });

    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7200000,
      sameSite: 'strict'
    });

    const { password: _, authToken: __, ...studentWithoutSensitive } = updatedStudent;
    return res.json({
      success: true,
      reason: 'ok',
      user: studentWithoutSensitive,
      token,
      currentQuestionId: student.currentQuestion?.questionId || '1',
      currentGroupId: student.currentQuestion?.groupId || '1',
      examStartTime: updatedStudent.examStartTime,
      examFinishedAt: updatedStudent.examFinishedAt || null
    });

  } catch (error) {
    console.error('Login error:', error);
    return respondError(res, 500, 'Server error during login', 'serverError');
  }
};

const handleAdminLogin = async (req, res) => {
  const { adminId, password } = req.body; // remove ip from body usage
  try {
    const adminsData = await EnvController.loadConfig('admin');
    const admin = adminsData.admins.find(a => a.adminId === adminId);

    if (!adminId || !password)
      return respondError(res, 400, 'Admin ID and password are required', 'missingAdminId');
    if (!admin)
      return respondError(res, 404, 'Admin not found', 'adminNotFound');
    if (password !== admin.password)
      return respondError(res, 403, 'Invalid credentials', 'invalidCredentials');

    const clientIp = getClientIp(req);

    const token = jwt.sign(
      { adminId: admin.adminId, name: admin.name, roles: admin.roles },
      JWT_SECRET,
      { expiresIn: '3h' }
    );

    const updatedAdmin = {
      ...admin,
      lastLogin: new Date().toISOString(),
      authToken: token,
      lastIp: admin.currentIp || clientIp,
      currentIp: clientIp,
      tokenExpiry: new Date(Date.now() + 10800000).toISOString()
    };

    const updatedAdmins = adminsData.admins.map(a =>
      a.adminId === adminId ? updatedAdmin : a
    );

    const activeConfig = EnvController.getActiveConfigs();
    await EnvController.createConfig(activeConfig.admins || 'admin.json', {
      ...adminsData,
      admins: updatedAdmins
    });

    res.cookie('adminAuthToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10800000,
      sameSite: 'strict'
    });

    const { password: _, authToken: __, ...adminWithoutSensitive } = updatedAdmin;
    return res.json({
      success: true,
      reason: 'ok',
      admin: adminWithoutSensitive,
      token
    });

  } catch (error) {
    console.error('Admin login error:', error);
    return respondError(res, 500, 'Server error during admin login', 'serverError');
  }
};

// Simplified: ONLY checks signature/expiry now (no IP inside token)
function verifyStudentToken(req, res) {
  const raw =
    req.cookies?.authToken ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);
  if (!raw) {
    return { ok: false, status: 401, reason: 'tokenMissing', message: 'Authentication token missing' };
  }
  try {
    const decoded = jwt.verify(raw, JWT_SECRET);
    return { ok: true, decoded };
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      return { ok: false, status: 401, reason: 'tokenExpired', message: 'Token expired' };
    }
    return { ok: false, status: 401, reason: 'tokenInvalid', message: 'Invalid token' };
  }
}

// GET /api/auth/validate (now performs IP comparison against stored student.currentIp)
async function handleValidate(req, res) {
  const vr = verifyStudentToken(req, res);
  if (!vr.ok) {
    return respondError(res, vr.status, vr.message, vr.reason);
  }

  try {
    const studentsData = await EnvController.loadConfig('students');
    const list = Array.isArray(studentsData.students) ? studentsData.students : [];
    const student = list.find(s => s.studentId === vr.decoded.studentId);

    if (!student) {
      return respondError(res, 404, 'Student not found', 'studentNotFound');
    }

    const currentIp = getClientIp(req);

    // Enforce IP check HERE (compare with stored currentIp instead of token)
    if (student.currentIp && student.currentIp !== currentIp) {
      return respondError(res, 401, 'IP changed. Please login again.', 'tokenIpMismatch');
    }

    // Ensure examStartTime
    let mutated = false;
    if (!student.examStartTime) {
      student.examStartTime = new Date().toISOString();
      mutated = true;
    }

    const startMs = new Date(student.examStartTime).getTime();
    const nowMs = Date.now();
    const elapsedSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
    const duration = parseInt(student.examDurationSeconds || EXAM_DURATION_SECONDS, 10);

    if (student.examFinishedAt || elapsedSec >= duration) {
      if (!student.examFinishedAt) {
        student.examFinishedAt = new Date().toISOString();
        mutated = true;
      }
      if (mutated) {
        const activeConfig = EnvController.getActiveConfigs();
        await EnvController.createConfig(activeConfig.students, {
          ...studentsData,
          students: list.map(s => s.studentId === student.studentId ? student : s)
        });
      }
      return respondError(
        res,
        440,
        `Exam time has ended (elapsed ${elapsedSec}s of ${duration}s).`,
        'timeout'
      );
    }

    if (mutated) {
      const activeConfig = EnvController.getActiveConfigs();
      await EnvController.createConfig(activeConfig.students, {
        ...studentsData,
        students: list.map(s => s.studentId === student.studentId ? student : s)
      });
    }

    return res.json({
      success: true,
      valid: true,
      remainingSeconds: duration - elapsedSec
    });

  } catch (e) {
    console.error('Validation error:', e);
    return respondError(res, 500, 'Server error during validation', 'serverError');
  }
}

module.exports = {
  handleLogin,
  handleAdminLogin,
  handleValidate
};