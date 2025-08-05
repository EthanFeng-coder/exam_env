const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class CodeExecutionHandler {
  async executeCode(code) {
    try {
      // Debug logging
      //console.log('\n=== Code Execution Started ===');
      //console.log('Received code:');
      //console.log(code || 'No code received');
      
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

      const dockerCommand = 'docker run --rm ' +
        '--network none ' +
        '--memory=512m ' +
        '--cpus=1 ' +
        `-e CODE="${code.replace(/"/g, '\\"')}" ` +
        '--security-opt=no-new-privileges ' +
        'csharp-runner';

      //console.log('Executing docker command:', dockerCommand);

      const { stdout, stderr } = await execPromise(dockerCommand, { 
        timeout: 10000,
        maxBuffer: 1024 * 1024
      });

      // Parse build output
      if (stdout.includes('Build FAILED')) {
        const errors = [];
        const lines = stdout.split('\n');
        const errorPattern = /Program\.cs\((\d+),(\d+)\): error (CS\d+): (.+?) \[/;
        
        // Get unique errors (first occurrence only)
        const seen = new Set();
        for (const line of lines) {
          const match = line.match(errorPattern);
          if (match && !seen.has(match[3])) { // Use error code as unique identifier
            seen.add(match[3]);
            errors.push({
              line: parseInt(match[1]),
              column: parseInt(match[2]),
              code: match[3],
              message: match[4].trim()
            });
          }
        }

        // Get error count from build output
        const errorCountMatch = stdout.match(/(\d+)\s+Error\(s\)/);
        const errorCount = errorCountMatch ? parseInt(errorCountMatch[1]) : errors.length;

        return {
          success: false,
          errors,
          errorCount,
          statusCode: 201
        };
      }

      // Handle successful build
      if (stdout.includes('Build succeeded.')) {
        const outputLines = stdout.split('\n');
        const startIndex = outputLines.findIndex(line => line.includes('Build succeeded.'));
        const programOutput = outputLines
          .slice(startIndex + 1)
          .filter(line => 
            line.trim() && 
            !line.includes('Warning(s)') && 
            !line.includes('Error(s)') && 
            !line.includes('Time Elapsed'))
          .join('\n');

        return {
          success: true,
          output: programOutput.trim()
        };
      }

      // Check for errors in stderr
      if (stderr) {
        const compilationErrors = this.parseCompilationErrors(stderr);
        if (compilationErrors.length > 0) {
          return { 
            success: false, 
            errors: compilationErrors
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

      return {
        success: true,
        output: executionOutput.trim()
      };

    } catch (error) {
      console.error('Execution error:', error);
      const buildOutput = error.stdout || '';
      
      // Try to parse build errors even from failed execution
      if (buildOutput.includes('Build FAILED')) {
        const errors = [];
        const lines = buildOutput.split('\n');
        const errorPattern = /Program\.cs\((\d+),(\d+)\): error (CS\d+): (.+?) \[/;
        
        const seen = new Set();
        for (const line of lines) {
          const match = line.match(errorPattern);
          if (match && !seen.has(match[3])) {
            seen.add(match[3]);
            errors.push({
              line: parseInt(match[1]),
              column: parseInt(match[2]),
              code: match[3],
              message: match[4].trim()
            });
          }
        }

        return {
          success: false,
          errors,
          errorCount: errors.length,
          statusCode: 201
        };
      }

      return {
        success: false,
        errors: ['Execution failed: ' + error.message],
        errorCount: 1,
        statusCode: 201
      };
    }
  }

  parseCompilationErrors(errorOutput) {
    const errors = [];
    const patterns = [
      /(Program\.cs)\((\d+),(\d+)\):\s*(error|warning)\s+(CS\d+):\s*(.+?)(?=(?:\r|\n|$))/,
      /error (CS\d+):\s*(.+?)(?=(?:\r|\n|$))/,
      /(error|warning):\s*(.+?)(?=(?:\r|\n|$))/
    ];

    const lines = errorOutput.split('\n');
    
    for (const pattern of patterns) {
      const matches = errorOutput.match(new RegExp(pattern, 'gm'));
      if (matches) {
        for (const match of matches) {
          const groups = match.match(pattern);
          if (pattern === patterns[0]) {
            errors.push({
              file: groups[1],
              line: parseInt(groups[2]),
              column: parseInt(groups[3]),
              severity: groups[4],
              errorCode: groups[5],
              message: groups[6].trim()
            });
          } else if (pattern === patterns[1]) {
            errors.push({
              file: 'Program.cs',
              line: 1,
              column: 1,
              severity: 'error',
              errorCode: groups[1],
              message: groups[2].trim()
            });
          } else {
            errors.push({
              file: 'Program.cs',
              line: 1,
              column: 1,
              severity: groups[1],
              errorCode: 'CS0000',
              message: groups[2].trim()
            });
          }
        }
        break;
      }
    }
    return errors;
  }

  parseRuntimeError(errorOutput) {
    const lines = errorOutput.split('\n');
    const exceptionPattern = /^Unhandled exception\. (.+?): (.+)$/;
    const locationPattern = /at .+ in .+:line (\d+)/;
    
    const error = {
      type: '',
      message: '',
      line: 1
    };

    for (const line of lines) {
      const exceptionMatch = line.match(exceptionPattern);
      if (exceptionMatch) {
        error.type = exceptionMatch[1];
        error.message = exceptionMatch[2];
        continue;
      }

      const locationMatch = line.match(locationPattern);
      if (locationMatch) {
        error.line = parseInt(locationMatch[1]);
        break;
      }
    }

    return error;
  }
}

module.exports = new CodeExecutionHandler();