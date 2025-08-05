const fs = require('fs').promises;
const path = require('path');

class QuestionController {
    async getQuestions() {
        try {
            const questionsPath = path.join(__dirname, '../data/question.json');
            const data = await fs.readFile(questionsPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading questions:', error);
            throw new Error('Failed to load questions');
        }
    }

    async getQuestionById(groupId, questionId, studentId = null) {
        try {
            const questions = await this.getQuestions();
            const group = questions.questionGroups.find(g => g.id === parseInt(groupId));
            if (!group) {
                throw new Error('Question group not found');
            }
            
            const totalQuestions = group.questions.length;
            const requestedQuestionIndex = parseInt(questionId);
            
            // Check if requesting question beyond available questions
            if (requestedQuestionIndex > totalQuestions && studentId) {
                // Check if all previous questions have submissions
                const hasAllSubmissions = await this.checkAllSubmissionsComplete(studentId, groupId, totalQuestions);
                
                if (hasAllSubmissions) {
                    await this.markExamFinished(studentId);
                    throw new Error('Exam completed - all questions answered');
                }
            }
            
            const question = group.questions.find(q => q.id === parseInt(questionId));
            if (!question) {
                throw new Error('Question not found');
            }

            return question;
        } catch (error) {
            console.error('Error getting question:', error);
            throw error;
        }
    }

    async checkAllSubmissionsComplete(studentId, groupId, totalQuestions) {
        try {
            const usersPath = path.join(__dirname, '../data/users.json');
            const usersData = JSON.parse(await fs.readFile(usersPath, 'utf8'));
            
            const user = usersData.users.find(u => u.studentId === studentId);
            if (!user || !user.submissions) {
                return false;
            }

            // Check if submissions exist for all questions (1 to totalQuestions)
            for (let i = 1; i <= totalQuestions; i++) {
                const hasSubmission = user.submissions.some(sub => 
                    sub.groupId === groupId && sub.questionId === String(i)
                );
                if (!hasSubmission) {
                    return false;
                }
            }
            
            return true;
        } catch (error) {
            console.error('Error checking submissions:', error);
            return false;
        }
    }

    async markExamFinished(studentId) {
        try {
            const usersPath = path.join(__dirname, '../data/users.json');
            const usersData = JSON.parse(await fs.readFile(usersPath, 'utf8'));
            
            const userIndex = usersData.users.findIndex(u => u.studentId === studentId);
            if (userIndex !== -1) {
                usersData.users[userIndex].examFinished = true;
                usersData.users[userIndex].examFinishedAt = new Date().toISOString();
                
                await fs.writeFile(usersPath, JSON.stringify(usersData, null, 2));
                console.log(`Exam marked as finished for student: ${studentId}`);
            }
        } catch (error) {
            console.error('Error marking exam finished:', error);
        }
    }
}

module.exports = new QuestionController();