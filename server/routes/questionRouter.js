const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');
const submissionController = require('../handlers/submissionHandler');
const studentController = require('../controllers/studentController');
const EnvController = require('../controllers/EnvController');

router.get('/:groupId/:questionId', async (req, res) => {
  try {
    const { groupId, questionId } = req.params;
    const studentId = req.headers['x-student-id'] || req.user?.studentId;

    if (!studentId) {
      return res.status(400).json({ success: false, error: 'Student ID is required' });
    }

    const studentsData = await EnvController.loadConfig('students');
    const studentsList = Array.isArray(studentsData.students) ? studentsData.students : [];
    let student = studentsList.find(s => s.studentId === studentId);

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    // Get (dynamic) exam duration (seconds)
    const examDurationSeconds = await EnvController.getExamDurationSeconds();

    // Ensure exam start time persisted once
    let mutated = false;
    if (!student.examStartTime) {
      student.examStartTime = new Date().toISOString();
      mutated = true;
    }

    const startMs = Date.parse(student.examStartTime);
    const nowMs = Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((nowMs - startMs) / 1000));
    let remainingSeconds = Math.max(0, examDurationSeconds - elapsedSeconds);

    // If time over, mark finished
    if (remainingSeconds === 0 && !student.examFinished) {
      student.examFinished = true;
      student.examFinishedAt = new Date().toISOString();
      mutated = true;
    }

    if (mutated) {
      await EnvController.createConfig(EnvController.getActiveConfigs().students, {
        ...studentsData,
        students: studentsList.map(s => s.studentId === student.studentId ? student : s)
      });
    }

    if (student.examFinished) {
      return res.status(200).json({
        success: false,
        examFinished: true,
        remainingSeconds: 0,
        error: 'Exam duration elapsed'
      });
    }

    // Load question
    const question = await questionController.getQuestionById(groupId, questionId, studentId);

    // Previous submission code override
    const prevSub = (student.submissions || []).find(sub => String(sub.questionId) === String(questionId));
    let initialCode = question.initialCode || '';
    if (prevSub) {
      initialCode = prevSub.code;
    } else if (!initialCode && String(questionId) !== '1') {
      try {
        const q1 = await questionController.getQuestionById(groupId, '1', studentId);
        if (q1?.initialCode) initialCode = q1.initialCode;
      } catch {}
    }

    return res.json({
      success: true,
      remainingSeconds,              // ONLY remaining time returned each request
      examFinished: false,
      question: {
        ...question,
        initialCode
        // NOTE: removed total duration & start time fields as requested
      }
    });
  } catch (error) {
    return res.status(404).json({
      success: false,
      error: error.message,
      examFinished: false,
      remainingSeconds: 0
    });
  }
});

module.exports = router;