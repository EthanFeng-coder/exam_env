const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken'); // You'll need to install jsonwebtoken

// Secret key for JWT - in production, use environment variable
const JWT_SECRET = 'your-secret-key';

// Read users data from JSON file
const getUsersData = () => {
  try {
    const rawData = fs.readFileSync(path.join(__dirname, '../data/users.json'));
    return JSON.parse(rawData);
  } catch (error) {
    console.error('Error reading users data:', error);
    return { users: [] };
  }
};

// Write users data to JSON file
const writeUsersData = (data) => {
  try {
    fs.writeFileSync(
      path.join(__dirname, '../data/users.json'),
      JSON.stringify(data, null, 2)
    );
    return true;
  } catch (error) {
    console.error('Error writing users data:', error);
    return false;
  }
};

// Handle login
const handleLogin = async (req, res) => {
  const { studentId, password, ip } = req.body;

  try {
    const usersData = getUsersData();
    const userIndex = usersData.users.findIndex(u => 
      u.studentId === studentId && u.password === password
    );

    if (userIndex !== -1) {
      const user = usersData.users[userIndex];
      const previousLastLogin = user.lastLogin; // Store previous login time
      const currentTime = new Date().toISOString();
      
      // Generate JWT token with IP
      const token = jwt.sign(
        { 
          studentId: user.studentId,
          ip: ip
        },
        JWT_SECRET,
        { expiresIn: '2h' }
      );

      // Update user data
      usersData.users[userIndex] = {
        ...user,
        lastLogin: currentTime,
        examStartTime: user.examStartTime || currentTime, // Set exam start time only if not already set
        authToken: token,
        lastIp: ip,
        currentIp: ip,
        tokenExpiry: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      };
      
      if (!writeUsersData(usersData)) {
        throw new Error('Failed to update user data');
      }

      // Set cookie
      res.cookie('authToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 2 * 60 * 60 * 1000,
        sameSite: 'strict'
      });

      // Get current question info
      const currentQuestion = user.currentQuestion || {
        groupId: '1', // Default group ID
        questionId: '1' // Default question ID
      };

      // Don't send sensitive data back to client
      const { password, authToken, ...userWithoutSensitive } = usersData.users[userIndex];
      return res.json({
        success: true,
        user: userWithoutSensitive,
        token,
        currentQuestionId: currentQuestion.questionId,
        currentGroupId: currentQuestion.groupId,
        examStartTime: usersData.users[userIndex].examStartTime,
        examFinishedAt: usersData.users[userIndex].examFinishedAt || null // Add this line
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

module.exports = {
  handleLogin
};