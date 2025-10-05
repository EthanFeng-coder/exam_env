const EnvController = require('../controllers/EnvController');

async function handleAutoSave(studentId, code, groupId, questionId) {
  try {
    if (!studentId || !groupId || !questionId || typeof code !== 'string') {
      return { success: false, message: 'Missing required fields' };
    }

    const studentsData = await EnvController.loadConfig('students');
    if (!studentsData || !Array.isArray(studentsData.students)) {
      throw new Error('Invalid students data structure');
    }

    const idx = studentsData.students.findIndex(s => s.studentId === studentId);
    if (idx === -1) return { success: false, message: 'Student not found' };

    const student = studentsData.students[idx];

    // Ensure autosave section exists: autosave[groupId][questionId] = { code, savedAt }
    student.autosave = student.autosave && typeof student.autosave === 'object' ? student.autosave : {};
    student.autosave[groupId] = student.autosave[groupId] && typeof student.autosave[groupId] === 'object'
      ? student.autosave[groupId]
      : {};

    const savedAt = new Date().toISOString();
    student.autosave[groupId][String(questionId)] = { code, savedAt };

    // Touch activity
    student.lastActivity = savedAt;
    student.currentQuestion = student.currentQuestion || { groupId: String(groupId), questionId: String(questionId) };

    // Persist
    const active = EnvController.getActiveConfigs();
    await EnvController.createConfig(active.students, {
      ...studentsData,
      students: studentsData.students.map(s => (s.studentId === studentId ? student : s))
    });

    return {
      success: true,
      message: 'Autosaved',
      savedAt,
      groupId: String(groupId),
      questionId: String(questionId)
    };
  } catch (err) {
    console.error('Autosave error:', err);
    return { success: false, message: 'Autosave failed', error: err.message };
  }
}

module.exports = { handleAutoSave };