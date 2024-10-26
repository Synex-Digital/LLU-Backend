#!/bin/bash

if [ -d ".git" ]; then
    git pull origin main
    npm install
fi