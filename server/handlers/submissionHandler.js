const EnvController = require('../controllers/EnvController');

const handleSubmission = async (studentId, code, groupId, questionId) => {
  try {
    // Load students data through EnvController
    const studentsData = await EnvController.loadConfig('students');
    //console.log('Loaded students data:', studentsData);
    
    // Validate data structure - expecting { students: [...] }
    if (!studentsData || !studentsData.students || !Array.isArray(studentsData.students)) {
      throw new Error('Invalid students data structure - expected { students: array }');
    }
    
    // Find existing student
    const studentIndex = studentsData.students.findIndex(s => s.studentId === studentId);
    if (studentIndex === -1) {
      throw new Error(`Student ${studentId} not found in database`);
    }

    // Get or initialize student submission data
    const student = studentsData.students[studentIndex];
    
    // Initialize submissions array if it doesn't exist
    student.submissions = student.submissions || [];
    
    // Initialize exam tracking if it doesn't exist
    student.examFinished = student.examFinished || false;
    student.currentQuestion = student.currentQuestion || { groupId: '1', questionId: '1' };

    // Remove existing submission for this question if present
    student.submissions = student.submissions.filter(
      sub => !(sub.groupId === groupId && sub.questionId === questionId)
    );

    // Add new submission
    student.submissions.push({
      groupId,
      questionId,
      code,
      submittedAt: new Date().toISOString()
    });

    // Check exam completion status
    const questionController = require('../controllers/questionController');
    const questions = await questionController.getQuestions();
    const group = questions.questionGroups.find(g => g.id === parseInt(groupId));
    const totalQuestions = group ? group.questions.length : 0;
    
    let examFinished = false;
    if (parseInt(questionId) === totalQuestions) {
      const allSubmissionsExist = Array.from({ length: totalQuestions }, (_, i) => i + 1)
        .every(qId => 
          student.submissions.some(sub => 
            sub.groupId === groupId && sub.questionId === String(qId)
          )
        );
      
      if (allSubmissionsExist) {
        student.examFinished = true;
        student.examFinishedAt = new Date().toISOString();
        examFinished = true;
      }
    }

    // Update student activity
    student.lastActivity = new Date().toISOString();
    if (!examFinished) {
      student.currentQuestion = {
        groupId,
        questionId: String(Number(questionId) + 1)
      };
    }

    // Update students data array while preserving the complete structure
    const updatedStudents = studentsData.students.map(s => 
      s.studentId === studentId ? student : s
    );

    // Save the complete structure back (including password and other fields)
    const activeConfig = EnvController.getActiveConfigs();
    await EnvController.createConfig(activeConfig.students, {
      ...studentsData,  // Preserve all existing fields (password, etc.)
      students: updatedStudents  // Update only the students array
    });

    return {
      success: true,
      message: examFinished ? 'Exam completed!' : 'Submission saved',
      nextQuestionId: examFinished ? null : String(Number(questionId) + 1),
      examFinished,
      studentName: student.fullName
    };

  } catch (error) {
    console.error('Submission error:', {
      error: error.message,
      studentId,
      questionId,
      groupId,
      stack: error.stack
    });
    throw error;
  }
};

module.exports = { handleSubmission };