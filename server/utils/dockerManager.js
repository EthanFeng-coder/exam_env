const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class DockerManager {
    async buildImage() {
        try {
            console.log('Building C# Docker image...');
            await execPromise('docker build -t csharp-runner ./docker');
            console.log('C# Docker image built successfully');
        } catch (error) {
            console.error('Error building C# Docker image:', error);
            throw error;
        }
    }

    async buildPythonImage() {
        try {
            console.log('Building Python Docker image...');
            await execPromise('docker build -f ./docker/Dockerfile.python -t python-runner ./docker');
            console.log('Python Docker image built successfully');
        } catch (error) {
            console.error('Error building Python Docker image:', error);
            throw error;
        }
    }

    async buildAllImages() {
        try {
            await this.buildImage();
            await this.buildPythonImage();
        } catch (error) {
            console.error('Error building Docker images:', error);
            throw error;
        }
    }

    async cleanup() {
        try {
            console.log('Cleaning up Docker resources...');
            await execPromise('docker ps -q --filter ancestor=csharp-runner | xargs -r docker stop');
            await execPromise('docker ps -q --filter ancestor=python-runner | xargs -r docker stop');
            console.log('Docker cleanup completed');
        } catch (error) {
            console.error('Error during Docker cleanup:', error);
        }
    }
}

module.exports = new DockerManager();