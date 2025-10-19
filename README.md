# Exam Environment

This project consists of a client and server application.

## Getting Started

### Client Setup

```bash
# Navigate to client directory
cd client

# Install dependencies
npm install

# Start development server
npm run start
```

The client will be available at `http://localhost:3000`

### Server Setup

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Start development server
npm run dev

node server.js
```
npm run dev
The server will be available at `http://localhost:5000`

## Prerequisites

- Node.js v18 or higher
- Docker
- .NET SDK 8.0

## Environment Setup

Make sure Docker is running and you have the proper permissions:

```bash
# Add your user to docker group
sudo usermod -aG docker $USER
# maybe needed
sudo chmod 666 /var/run/docker.sock
# Verify Docker is running
sudo systemctl status docker
```

## Development

Run both client and server in separate terminal windows for development.

to do list 
#not support safari
# try koisk

# test curl
(base) ethan@ethan-X870E-AORUS-MASTER:/media/ethan/5c9378d9-5645-4d90-86f1-b791150c9ded/Github/exam_env$  curl -X POST http://localhost:5000/api/code/pyexecute   -H "Content-Type: application/json"   -d '{"code": "import math\nprint(math.sqrt(16))\nprint(math.pi)"}'
