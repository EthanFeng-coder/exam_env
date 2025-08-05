#!/bin/bash
set -e

# Create project directory
mkdir -p /app/project
cd /app/project

# Initialize new console project
dotnet new console --force

# Write code to Program.cs
echo "$CODE" > Program.cs

# Build and run
dotnet build
dotnet run --no-build