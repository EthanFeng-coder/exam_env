const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class DockerManager {
    async buildImage() {
        try {
            console.log('Building Docker image...');
            await execPromise('docker build -t csharp-runner ./docker');
            console.log('Docker image built successfully');
        } catch (error) {
            console.error('Error building Docker image:', error);
            throw error;
        }
    }

    async cleanup() {
        try {
            console.log('Cleaning up Docker resources...');
            await execPromise('docker ps -q --filter ancestor=csharp-runner | xargs -r docker stop');
            console.log('Docker cleanup completed');
        } catch (error) {
            console.error('Error during Docker cleanup:', error);
        }
    }
}

module.exports = new DockerManager();