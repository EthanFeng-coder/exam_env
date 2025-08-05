// Create a new file: server/controllers/studentController.js
const fs = require('fs');
const path = require('path');

// Read students data from JSON file
const getStudentsData = () => {
  try {
    const rawData = fs.readFileSync(path.join(__dirname, '../data/users.json'));
    const data = JSON.parse(rawData);
    //console.log('Data read from users.json:', data); // Debugging line to check data structure
    // Changed from data.students to data.users
    return { students: data.users || [] };  // Maintains compatibility with existing code
  } catch (error) {
    console.error('Error reading students data:', error);
    return { students: [] };
  }
};

// Write students data to JSON file
const writeStudentsData = (data) => {
  try {
    fs.writeFileSync(
      path.join(__dirname, '../data/users.json'),
      JSON.stringify(data, null, 2)
    );
    return true;
  } catch (error) {
    console.error('Error writing students data:', error);
    return false;
  }
};

// Get student by ID
const getStudentById = async (studentId) => {
  try {
    const studentsData = getStudentsData();
    // console.log('Students data structure:', studentsData);
    // console.log('Looking for studentId:', studentId);
    // console.log('Available student IDs:', studentsData.students.map(s => s.studentId));
    
    // Ensure students array exists
    if (!studentsData.students || !Array.isArray(studentsData.students)) {
      throw new Error('Students data is not properly formatted');
    }
    
    const student = studentsData.students.find(s => {
      //console.log(`Comparing ${s.studentId} with ${studentId} (types: ${typeof s.studentId}, ${typeof studentId})`);
      return s.studentId === studentId;
    });
    
    if (!student) throw new Error('Student not found');
    return student;
  } catch (error) {
    console.error('Error fetching student:', error);
    throw new Error('Failed to fetch student');
  }
};

// Update student data
const updateStudent = async (studentId, updateData) => {
  try {
    const studentsData = getStudentsData();
    const studentIndex = studentsData.students.findIndex(s => s.studentId === studentId);

    if (studentIndex !== -1) {
      studentsData.students[studentIndex] = {
        ...studentsData.students[studentIndex],
        ...updateData
      };

      if (!writeStudentsData(studentsData)) {
        throw new Error('Failed to update student data');
      }

      return studentsData.students[studentIndex];
    }

    throw new Error('Student not found');
  } catch (error) {
    console.error('Error updating student:', error);
    throw new Error('Failed to update student');
  }
};

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

// Get user by ID
const getUserById = async (userId) => {
  try {
    const usersData = getUsersData();
    const user = usersData.users.find(u => u.userId === userId);
    if (!user) throw new Error('User not found');
    return user;
  } catch (error) {
    console.error('Error fetching user:', error);
    throw new Error('Failed to fetch user');
  }
};

// Update user data
const updateUser = async (userId, updateData) => {
  try {
    const usersData = getUsersData();
    const userIndex = usersData.users.findIndex(u => u.userId === userId);

    if (userIndex !== -1) {
      usersData.users[userIndex] = {
        ...usersData.users[userIndex],
        ...updateData
      };

      if (!writeUsersData(usersData)) {
        throw new Error('Failed to update user data');
      }

      return usersData.users[userIndex];
    }

    throw new Error('User not found');
  } catch (error) {
    console.error('Error updating user:', error);
    throw new Error('Failed to update user');
  }
};

module.exports = {
  getStudentById,
  updateStudent,
  getUserById,
  updateUser
};