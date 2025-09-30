const EnvController = require('../controllers/EnvController');
const path = require('path');
const fs = require('fs').promises;
const questionController = require('../controllers/questionController');

const handleMarking = async (req, res) => {
  try {
    // Get adminId from request (or use JWT/session in production)
    const { adminId } = req.body;

    // Load admin data
    const adminData = await EnvController.loadConfig('admin');
    const admin = adminData.admins.find(a => a.adminId === adminId);

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Admin not found' });
    }

    if (!Array.isArray(admin.studentGroups) || admin.studentGroups.length === 0) {
      return res.status(400).json({ success: false, message: 'No student groups assigned to this admin.' });
    }

    // Collect all students' answers for the admin's groups
    const groupResults = {};

    for (const groupFile of admin.studentGroups) {
      // Compose the path to the group file (e.g., ICT_313_can.json)
      const groupFilePath = path.join(__dirname, '../data', `${groupFile}.json`);
      try {
        const fileContent = await fs.readFile(groupFilePath, 'utf8');
        const groupData = JSON.parse(fileContent);
        console.log(`Loaded group file: ${groupFile}`);
        // Collect students and their submissions
        groupResults[groupFile] = (groupData.students || []).map(student => ({
          studentId: student.studentId,
          fullName: student.fullName,
          submissions: student.submissions || []
        }));
      } catch (err) {
        groupResults[groupFile] = { error: `Could not load group file: ${groupFile}` };
      }
    }

    return res.json({
      success: true,
      groups: groupResults
    });

  } catch (error) {
    console.error('Marking handler error:', error);
    return res.status(500).json({ success: false, message: 'Server error during marking load' });
  }
};

// NEW: load one student's selected question + their submission (answer)
const handleStudentQuestion = async (req, res) => {
  try {
    const { adminId, groupFile, studentId, questionId } = req.body;

    if (!adminId || !groupFile || !studentId || !questionId) {
      return res.status(400).json({
        success: false,
        message: 'adminId, groupFile, studentId, and questionId are required',
        reason: 'badRequest'
      });
    }

    // Validate admin
    const adminData = await EnvController.loadConfig('admin');
    const admin = adminData.admins.find(a => a.adminId === adminId);
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Admin not found', reason: 'adminNotFound' });
    }
    if (!admin.studentGroups.includes(groupFile)) {
      return res.status(403).json({ success: false, message: 'Not allowed for this group', reason: 'forbiddenGroup' });
    }

    // Load group student data file
    const groupFilePath = path.join(__dirname, '../data', `${groupFile}.json`);
    let groupData;
    try {
      groupData = JSON.parse(await fs.readFile(groupFilePath, 'utf8'));
    } catch {
      return res.status(404).json({ success: false, message: 'Group file not found', reason: 'groupFileMissing' });
    }

    const studentsArr = Array.isArray(groupData.students) ? groupData.students : [];
    const student = studentsArr.find(s => String(s.studentId) === String(studentId));
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not in group', reason: 'studentNotInGroup' });
    }

    // Load questions
    const qData = await questionController.getQuestions();
    const group = (qData.questionGroups || []).find(g => String(g.id) === String(groupData.groupId || 1) || true); // fallback
    // Flatten search
    let foundQuestion;
    (qData.questionGroups || []).forEach(g => {
      (g.questions || []).forEach(q => {
        if (String(q.id) === String(questionId)) {
          foundQuestion = { groupId: g.id, ...q };
        }
      });
    });

    if (!foundQuestion) {
      return res.status(404).json({ success: false, message: 'Question not found', reason: 'questionNotFound' });
    }

    // Locate submission
    const submission = (student.submissions || []).find(
      sub => String(sub.questionId) === String(questionId)
    ) || null;

    return res.json({
      success: true,
      student: { studentId: student.studentId, fullName: student.fullName },
      question: {
        id: foundQuestion.id,
        groupId: foundQuestion.groupId,
        title: foundQuestion.title,
        description: foundQuestion.description,
        initialCode: foundQuestion.initialCode || ''
      },
      submission // null if no answer yet
    });

  } catch (e) {
    console.error('handleStudentQuestion error:', e);
    return res.status(500).json({
      success: false,
      message: 'Server error while loading student question',
      reason: 'serverError'
    });
  }
};

// NEW: return ALL submissions for one student with merged question metadata
const handleStudentFull = async (req, res) => {
  try {
    const { adminId, groupFile, studentId } = req.body;
    if (!adminId || !groupFile || !studentId) {
      return res.status(400).json({ success: false, message: 'adminId, groupFile and studentId are required', reason: 'badRequest' });
    }

    // Validate admin
    const adminData = await EnvController.loadConfig('admin');
    const admin = adminData.admins.find(a => a.adminId === adminId);
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Admin not found', reason: 'adminNotFound' });
    }
    if (!admin.studentGroups.includes(groupFile)) {
      return res.status(403).json({ success: false, message: 'Not allowed for this group', reason: 'forbiddenGroup' });
    }

    // Load group file
    const groupFilePath = path.join(__dirname, '../data', `${groupFile}.json`);
    let groupData;
    try {
      groupData = JSON.parse(await fs.readFile(groupFilePath, 'utf8'));
    } catch {
      return res.status(404).json({ success: false, message: 'Group file not found', reason: 'groupFileMissing' });
    }

    const studentsArr = Array.isArray(groupData.students) ? groupData.students : [];
    const student = studentsArr.find(s => String(s.studentId) === String(studentId));
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not in group', reason: 'studentNotInGroup' });
    }

    // Build 2‑level map: questionMap[groupId][questionId] = question
    const qData = await questionController.getQuestions();
    const questionMap = {};
    (qData.questionGroups || []).forEach(g => {
      if (!questionMap[g.id]) questionMap[g.id] = {};
      (g.questions || []).forEach(q => {
        questionMap[g.id][q.id] = { ...q, groupId: g.id };
      });
    });

    // Helper to resolve a question reliably
    function resolveQuestion(s) {
      const qId = String(s.questionId);
      const gId = s.groupId || s.group || null;

      // 1. Direct lookup if groupId present
      if (gId && questionMap[gId] && questionMap[gId][qId]) {
        return questionMap[gId][qId];
      }

      // 2. Unique match across groups (if only one group has that question id)
      const matches = [];
      Object.values(questionMap).forEach(groupObj => {
        if (groupObj[qId]) matches.push(groupObj[qId]);
      });
      if (matches.length === 1) return matches[0];

      // 3. Ambiguous or not found: return null (avoid defaulting to first group’s Q1)
      return null;
    }

    const submissions = (student.submissions || []).map(sub => {
      const q = resolveQuestion(sub);

      return {
        questionId: sub.questionId,
        groupId: (q && q.groupId) || sub.groupId || sub.group || 'unknown',
        submittedAt: sub.submittedAt || '',
        code: sub.code || '',
        question: {
          title: (q && q.title) || `Question ${sub.questionId}`,
          description: (q && q.description) || '',
          // ALWAYS authoritative initial code from the resolved question
            initialCode: (q && q.initialCode) || ''
        }
      };
    });

    return res.json({
      success: true,
      student: { studentId: student.studentId, fullName: student.fullName },
      totalSubmissions: submissions.length,
      submissions
    });

  } catch (e) {
    console.error('handleStudentFull error:', e);
    return res.status(500).json({ success: false, message: 'Server error loading full student data', reason: 'serverError' });
  }
};

module.exports = { handleMarking, handleStudentQuestion, handleStudentFull };