const jwt = require('jsonwebtoken');

const EnvController = require('../controllers/EnvController');

// Load JWT secret from environment
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const handleLogin = async (req, res) => {
  const { studentId, password, ip } = req.body;

  try {
    // Load students data
    const studentsData = await EnvController.loadConfig('students');
    
    // Get global password
    const globalPassword = studentsData.password;
    
    // Find student
    const student = studentsData.students.find(s => s.studentId === studentId);
    
    if (!student) {
      return res.status(401).json({
        success: false,
        message: 'Student not found'
      });
    }
    if (!studentId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Student ID and password are required'
      });
    }
    // Compare with global password
    if (password !== globalPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        showPopup: true,
        popupDuration: 10
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { studentId, ip },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    // Update student record
    const updatedStudent = {
      ...student,
      lastLogin: new Date().toISOString(),
      examStartTime: student.examStartTime || new Date().toISOString(),
      authToken: token,
      lastIp: ip,
      currentIp: ip,
      tokenExpiry: new Date(Date.now() + 7200000).toISOString()
    };

    // Update students data array while preserving the complete structure
    const updatedStudents = studentsData.students.map(s => 
      s.studentId === studentId ? updatedStudent : s
    );

    // Save the complete structure back (including password and other fields)
    const activeConfig = EnvController.getActiveConfigs();
    await EnvController.createConfig(activeConfig.students, {
      ...studentsData,  // Preserve all existing fields (password, etc.)
      students: updatedStudents  // Update only the students array
    });

    // Set HTTP-only cookie
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7200000, // 2 hours
      sameSite: 'strict'
    });

    // Return response without sensitive data
    const { password: _, authToken: __, ...studentWithoutSensitive } = updatedStudent;
    return res.json({
      success: true,
      user: studentWithoutSensitive,
      token,
      currentQuestionId: student.currentQuestion?.questionId || '1',
      currentGroupId: student.currentQuestion?.groupId || '1',
      examStartTime: updatedStudent.examStartTime,
      examFinishedAt: updatedStudent.examFinishedAt || null
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

const handleAdminLogin = async (req, res) => {
  const { adminId, password, ip } = req.body;

  try {
    // Load admins data
    const adminsData = await EnvController.loadConfig('admin');

    // Find admin by adminId
    const admin = adminsData.admins.find(a => a.adminId === adminId);

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin not found'
      });
    }
    if (!adminId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Admin ID and password are required'
      });
    }
    // Compare with individual admin password
    if (password !== admin.password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        showPopup: true,
        popupDuration: 10
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { adminId: admin.adminId, name: admin.name, ip, roles: admin.roles },
      JWT_SECRET,
      { expiresIn: '3h' }
    );

    // Update admin record
    const updatedAdmin = {
      ...admin,
      lastLogin: new Date().toISOString(),
      authToken: token,
      lastIp: ip,
      currentIp: ip,
      tokenExpiry: new Date(Date.now() + 7200000).toISOString()
    };

    // Update admins data array while preserving the complete structure
    const updatedAdmins = adminsData.admins.map(a =>
      a.adminId === adminId ? updatedAdmin : a
    );

    // Save the complete structure back (including password and other fields)
    const activeConfig = EnvController.getActiveConfigs();
    await EnvController.createConfig(activeConfig.admins || 'admin.json', {
      ...adminsData,
      admins: updatedAdmins
    });

    // Set HTTP-only cookie
    res.cookie('adminAuthToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7200000,
      sameSite: 'strict'
    });

    // Return response without sensitive data
    const { password: _, authToken: __, ...adminWithoutSensitive } = updatedAdmin;
    return res.json({
      success: true,
      admin: adminWithoutSensitive,
      token
    });

  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during admin login'
    });
  }
};

module.exports = {
  handleLogin,
  handleAdminLogin
};