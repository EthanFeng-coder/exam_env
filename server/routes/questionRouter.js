const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');
const submissionController = require('../handlers/submissionHandler');
const studentController = require('../controllers/studentController');

// Get specific question
router.get('/:groupId/:questionId', async (req, res) => {
  try {
    const { groupId, questionId } = req.params;
    const studentId = req.headers['x-student-id'] || req.user?.studentId;

    console.log('Received request with params:', { groupId, questionId, studentId });

    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: 'Student ID is required'
      });
    }

    // Get the student first to check exam status
    const student = await studentController.getStudentById(studentId);
    console.log('Student retrieved:', student);
    
    // Check if exam is already finished
    if (student?.examFinished) {
      return res.status(200).json({
        success: false,
        examCompleted: true,
        examFinished: true,
        error: 'Exam has already been completed'
      });
    }

    // Get the question with student ID for exam completion check
    const question = await questionController.getQuestionById(groupId, questionId, studentId);
    //console.log('Question retrieved:', question);
    
    const previousSubmission = student?.submissions?.find(sub => sub.questionId === questionId);
    //console.log('Previous submission:', previousSubmission);

    // Determine the initial code
    let initialCode = question.initialCode;
    if (previousSubmission) {
      initialCode = previousSubmission.code;
    }

    res.json({
      success: true,
      question: {
        ...question,
        initialCode
      },
      examFinished: false // Explicitly set to false since exam is not finished
    });
  } catch (error) {
    console.error('Error in question endpoint:', error);
    
    // Check if exam is completed
    if (error.message === 'Exam completed - all questions answered') {
      return res.status(200).json({
        success: false,
        examCompleted: true,
        examFinished: true,
        error: error.message
      });
    }
    
    res.status(404).json({
      success: false,
      error: error.message,
      examFinished: false
    });
  }
});

module.exports = router;