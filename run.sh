#!/bin/bash

if [ -d ".git" ]; then
    echo "Git repository detected. Pulling latest changes..."
    git pull origin main
    echo "Changes pulled successfully."
else
    echo "No Git repository found in the current directory."
fi