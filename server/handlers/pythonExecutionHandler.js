const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class PythonExecutionHandler {
  async executeCode(code) {
    try {
      // Check if code is empty
      if (!code || code.trim() === '') {
        console.log('Empty code received');
        return {
          success: false,
          error: {
            type: 'ValidationError',
            message: 'No code provided'
          }
        };
      }

      // Escape code for shell execution
      const escapedCode = code.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/`/g, '\\`');
      
      const dockerCommand = 'docker run --rm ' +
        '--network none ' +
        '--memory=512m ' +
        '--cpus=1 ' +
        `--env CODE="${escapedCode}" ` +
        '--security-opt=no-new-privileges ' +
        'python-runner';

      const { stdout, stderr } = await execPromise(dockerCommand, { 
        timeout: 10000,
        maxBuffer: 1024 * 1024
      });

      // Check for syntax errors in stderr
      if (stderr) {
        const syntaxErrors = this.parseSyntaxErrors(stderr);
        if (syntaxErrors.length > 0) {
          return {
            success: false,
            errors: syntaxErrors,
            errorCount: syntaxErrors.length,
            statusCode: 201
          };
        }

        const runtimeError = this.parseRuntimeError(stderr);
        if (runtimeError.type || runtimeError.message) {
          return {
            success: false,
            error: runtimeError
          };
        }
      }

      // Handle successful execution
      if (stdout) {
        return {
          success: true,
          output: stdout.trim()
        };
      }

      return {
        success: true,
        output: ''
      };

    } catch (error) {
      console.error('Python execution error:', error);
      
      // Try to parse errors from stderr even on failed execution
      if (error.stderr) {
        const syntaxErrors = this.parseSyntaxErrors(error.stderr);
        if (syntaxErrors.length > 0) {
          return {
            success: false,
            errors: syntaxErrors,
            errorCount: syntaxErrors.length,
            statusCode: 201
          };
        }

        const runtimeError = this.parseRuntimeError(error.stderr);
        if (runtimeError.type || runtimeError.message) {
          return {
            success: false,
            error: runtimeError
          };
        }
      }

      return {
        success: false,
        errors: ['Execution failed: ' + error.message],
        errorCount: 1,
        statusCode: 201
      };
    }
  }

  parseSyntaxErrors(errorOutput) {
    const errors = [];
    const lines = errorOutput.split('\n');
    
    // Python syntax error patterns
    const patterns = [
      // File "main.py", line 5
      /File "(.+?)", line (\d+)/,
      // SyntaxError: invalid syntax
      /(SyntaxError|IndentationError|TabError): (.+?)$/,
      // Generic Python error
      /(\w+Error): (.+?)$/
    ];

    let currentError = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for file location pattern
      const fileMatch = line.match(patterns[0]);
      if (fileMatch) {
        currentError = {
          file: fileMatch[1],
          line: parseInt(fileMatch[2]),
          column: 1,
          severity: 'error',
          errorCode: 'SYNTAX_ERROR',
          message: ''
        };
        continue;
      }

      // Check for syntax error patterns
      for (let j = 1; j < patterns.length; j++) {
        const errorMatch = line.match(patterns[j]);
        if (errorMatch) {
          if (currentError) {
            currentError.errorCode = errorMatch[1];
            currentError.message = errorMatch[2].trim();
            errors.push(currentError);
            currentError = null;
          } else {
            errors.push({
              file: 'main.py',
              line: 1,
              column: 1,
              severity: 'error',
              errorCode: errorMatch[1],
              message: errorMatch[2].trim()
            });
          }
          break;
        }
      }

      // Look for column indicator (^)
      if (currentError && line.match(/^\s*\^/)) {
        const spaces = line.indexOf('^');
        if (spaces >= 0) {
          currentError.column = spaces + 1;
        }
      }
    }

    // If we have an incomplete error, add it
    if (currentError && currentError.message === '') {
      currentError.message = 'Syntax error';
      errors.push(currentError);
    }

    return errors;
  }

  parseRuntimeError(errorOutput) {
    const lines = errorOutput.split('\n');
    const tracebackStart = lines.findIndex(line => line.startsWith('Traceback'));
    
    if (tracebackStart === -1) {
      return { type: '', message: '', line: 1 };
    }

    const error = {
      type: '',
      message: '',
      line: 1
    };

    // Look for the last exception line
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      const exceptionMatch = line.match(/^(\w+Error): (.+)$/);
      
      if (exceptionMatch) {
        error.type = exceptionMatch[1];
        error.message = exceptionMatch[2];
        break;
      }
    }

    // Look for line number in traceback
    for (let i = tracebackStart; i < lines.length; i++) {
      const line = lines[i];
      const lineMatch = line.match(/File "(.+?)", line (\d+)/);
      
      if (lineMatch && lineMatch[1].includes('main.py')) {
        error.line = parseInt(lineMatch[2]);
        break;
      }
    }

    return error;
  }
}

module.exports = new PythonExecutionHandler();