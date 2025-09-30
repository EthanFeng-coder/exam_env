const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { handleLogin, handleAdminLogin, handleValidate } = require('./handlers/authHandler'); // <-- Update this line
const codeExecutionHandler = require('./handlers/codeExecutionHandler');
const dockerManager = require('./utils/dockerManager');
const questionRouter = require('./routes/questionRouter');
const { handleSubmission } = require('./handlers/submissionHandler');
const { handleMarking, handleStudentQuestion, handleStudentFull } = require('./handlers/markingHandler');
const verifySession = require('./middleware/verifySession');
const markingRouter = require('./routes/markingRouter');
const app = express();
app.use(cookieParser());

// Enable CORS with specific options
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  methods: ['POST'],
  allowedHeaders: ['Content-Type', 'Accept']
}));

// Parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic routes without parameters
app.post('/api/login', handleLogin);

// Add admin login endpoint
app.post('/api/admin-login', handleAdminLogin); // <-- Add this line

app.post('/api/code/execute', async (req, res) => {
  try {
    const result = await codeExecutionHandler.executeCode(req.body.code);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        type: 'ServerError',
        message: error.message
      }
    });
  }
});

// Add question routes
app.use('/api/questions', questionRouter);

// Update the submission route to properly use verifySession middleware
app.post('/api/submit', async (req, res) => {
  try {
    const { code, groupId, questionId, studentId } = req.body;
    
    if (!code || !groupId || !questionId || !studentId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Use the studentId from the request body instead of req.user
    const result = await handleSubmission(studentId, code, groupId, questionId);
    res.json(result);
  } catch (error) {
    console.error('Submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process submission'
    });
  }
});

// Add marking route
app.use('/api', markingRouter);
app.post('/api/marking', handleMarking);
app.post('/api/marking/student', handleStudentQuestion);
app.post('/api/marking/student/full', handleStudentFull); // NEW full student results endpoint

// Add auth validation route
app.get('/api/auth/validate', handleValidate);

const process = require('process');

// Add graceful shutdown handler before startServer()
process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Performing graceful shutdown...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT. Performing graceful shutdown...');
  process.exit(0);
});

// Update your startServer function
async function startServer() {
  try {
    await dockerManager.buildImage();
    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
      console.log('Press CTRL-C to stop');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
}

startServer();