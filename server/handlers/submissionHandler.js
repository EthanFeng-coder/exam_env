const fs = require('fs').promises;
const path = require('path');

const handleSubmission = async (studentId, code, groupId, questionId) => {
  try {
    const usersFilePath = path.join(__dirname, '../data/users.json');
    const usersData = JSON.parse(await fs.readFile(usersFilePath, 'utf8'));

    const userIndex = usersData.users.findIndex(u => u.studentId === studentId);
    if (userIndex === -1) {
      throw new Error('User not found');
    }

    // Initialize submissions array if it doesn't exist
    if (!usersData.users[userIndex].submissions) {
      usersData.users[userIndex].submissions = [];
    }

    // Remove any existing submission for this question
    usersData.users[userIndex].submissions = usersData.users[userIndex].submissions.filter(
      sub => sub.questionId !== questionId
    );

    // Add new submission
    const submission = {
      groupId,
      questionId,
      code,
      submittedAt: new Date().toISOString()
    };

    usersData.users[userIndex].submissions.push(submission);
    
    // Get total questions to check if this is the last question
    const questionController = require('../controllers/questionController');
    const questions = await questionController.getQuestions();
    const group = questions.questionGroups.find(g => g.id === parseInt(groupId));
    const totalQuestions = group ? group.questions.length : 0;
    
    const currentQuestionIndex = parseInt(questionId);
    let examFinished = false;
    
    // Check if this is the last question submission
    if (currentQuestionIndex === totalQuestions) {
      // Check if all previous questions have submissions
      console.log(`checking if exam is finished for student: ${studentId}`);
      let allSubmissionsExist = true;
      for (let i = 1; i <= totalQuestions-1; i++) {
          const hasSubmission = usersData.users[userIndex].submissions.some(sub => 
          sub.groupId === groupId && sub.questionId === String(i)
        );
        console.log(`Checking submission for question ${i}: ${hasSubmission}`);
        if (!hasSubmission) {
          allSubmissionsExist = false;
          break;
        }
      }
      
      // If all submissions exist, mark exam as finished
      if (allSubmissionsExist) {
        usersData.users[userIndex].examFinished = true;
        usersData.users[userIndex].examFinishedAt = new Date().toISOString();
        examFinished = true;
        console.log(`Exam marked as finished for student: ${studentId}`);
      }
    }
    
    // Update last activity and current question index (only if exam not finished)
    usersData.users[userIndex].lastActivity = new Date().toISOString();
    if (!examFinished) {
      usersData.users[userIndex].currentQuestion = {
        groupId,
        questionId: String(Number(questionId) + 1)
      };
    }

    // Write updated data back to file
    await fs.writeFile(usersFilePath, JSON.stringify(usersData, null, 2));

    return {
      success: true,
      message: examFinished ? 'Exam completed successfully!' : 'Submission recorded successfully',
      nextQuestionId: examFinished ? null : String(Number(questionId) + 1),
      examFinished: examFinished
    };
  } catch (error) {
    console.error('Submission handling error:', error);
    throw error;
  }
};

module.exports = { handleSubmission };