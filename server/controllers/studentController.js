// server/controllers/StudentController.js
const bcrypt = require('bcryptjs');
class StudentController {
  static async getStudentById(studentId) {
    try {
      // Load from environment-configured source
      const students = JSON.parse(process.env.STUDENTS_DATA || '[]');
      return students.find(s => s.studentId === studentId);
    } catch (error) {
      console.error('Error loading student:', error);
      return null;
    }
  }

  static async updateStudent(studentId, updatedData) {
    try {
      let students = JSON.parse(process.env.STUDENTS_DATA || '[]');
      const index = students.findIndex(s => s.studentId === studentId);
      
      if (index !== -1) {
        students[index] = updatedData;
        // In a real implementation, you would update the environment source here
        // For example: process.env.STUDENTS_DATA = JSON.stringify(students);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating student:', error);
      return false;
    }
  }

  static async createStudent(studentData) {
    try {
      const hashedPassword = await bcrypt.hash(studentData.password, 10);
      let students = JSON.parse(process.env.STUDENTS_DATA || '[]');
      
      students.push({
        ...studentData,
        password: hashedPassword,
        createdAt: new Date().toISOString()
      });
      
      // In a real implementation, update the environment source
      // process.env.STUDENTS_DATA = JSON.stringify(students);
      return true;
    } catch (error) {
      console.error('Error creating student:', error);
      return false;
    }
  }
}

module.exports = StudentController;