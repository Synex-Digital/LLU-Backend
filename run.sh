#!/bin/bash

if [ -d ".git" ]; then
    npm install
    git pull origin main
fi