const fs = require('fs').promises;
const path = require('path');

class EnvController {
  constructor() {
    this.activeConfigs = {
      students: 'ICT_212_can.json',
      admin: 'admin.json',
      questions: 'question.json'
    };
    this.configDir = path.join(__dirname, '../data');
  }

  // Get current active configuration
  getActiveConfigs() {
    return {
      students: 'ICT_212_can.json',
      admin: 'admin.json',
      questions: 'question.json'
    };
  }

  // Set active configuration for a specific type
  async setActiveConfig(type, filename) {
    try {
      // Verify file exists
      const filePath = path.join(this.configDir, filename);
      await fs.access(filePath);
      
      this.activeConfigs[type] = filename;
      return { success: true, message: `Active ${type} config set to ${filename}` };
    } catch (error) {
      return { 
        success: false, 
        error: `Config file ${filename} not found`,
        details: error.message 
      };
    }
  }

  // Load the currently active config for a type
  async loadConfig(type) {
    try {
      if (!this.activeConfigs[type]) {
        throw new Error(`No config type ${type} defined`);
      }

      const filePath = path.join(this.configDir, this.activeConfigs[type]);
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error loading ${type} config:`, error);
      throw error;
    }
  }

  // List available config files of a type
  async listAvailableConfigs(typePattern = '*.json') {
    try {
      const files = await fs.readdir(this.configDir);
      return files.filter(file => file.match(typePattern));
    } catch (error) {
      console.error('Error listing config files:', error);
      return [];
    }
  }

  // Create a new config file
  async createConfig(filename, content) {
    try {
      const filePath = path.join(this.configDir, filename);
      await fs.writeFile(filePath, JSON.stringify(content, null, 2));
      return { success: true, message: `Created ${filename}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Update an existing config file
  async updateConfig(type, data) {
    try {
      const filename = this.activeConfigs[type];
      if (!filename) {
        throw new Error(`No active config found for type: ${type}`);
      }
      
      const filePath = path.join(this.configDir, filename);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      
      return { success: true, message: `${type} config updated successfully` };
    } catch (error) {
      console.error(`Error updating ${type} config:`, error);
      throw error;
    }
  }

  // NEW: get exam duration (seconds)
  // Rule you requested: take the second questionGroup's examDuration if present,
  // else fall back to any group with exam:true, else env/default.
  async getExamDurationSeconds() {
    try {
      const questionsCfg = await this.loadConfig('questions');
      const groups = Array.isArray(questionsCfg.questionGroups)
        ? questionsCfg.questionGroups
        : [];

      let duration;

      // Prefer second group (index 1) if it has examDuration / examDurationSeconds
      if (groups[1]) {
        const g = groups[1];
        duration =
          g.examDuration ??
          g.examDurationSeconds ??
          (g.exam ? g.durationSeconds : undefined);
      }

      // If not found, try any group with exam:true
      if (
        (duration === undefined || duration === null || duration <= 0) &&
        groups.length
      ) {
        const examGroup =
          groups.find(g => g.exam === true && (g.examDuration || g.examDurationSeconds || g.durationSeconds)) ||
          groups[0];
        if (examGroup) {
          duration =
            examGroup.examDuration ??
            examGroup.examDurationSeconds ??
            examGroup.durationSeconds;
        }
      }

      // Global fallback fields at root
      if (duration === undefined || duration === null || duration <= 0) {
        duration =
          questionsCfg.examDurationSeconds ??
          questionsCfg.examDuration ??
          questionsCfg.durationSeconds ??
          process.env.EXAM_DURATION_SECONDS;
      }

      const n = Number(duration);
      return Number.isFinite(n) && n > 0 ? n : 3600;
    } catch (e) {
      const envVal = Number(process.env.EXAM_DURATION_SECONDS);
      return Number.isFinite(envVal) && envVal > 0 ? envVal : 3600;
    }
  }
}

module.exports = new EnvController();
