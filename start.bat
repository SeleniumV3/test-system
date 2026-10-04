@echo off

echo Checking backend dependencies...

if not exist "node_modules\" (
    echo Installing required packages...
    call npm install express body-parser cors
)

echo Starting Node.js API on port 3000...
start cmd /k "node app.js"

if exist "frontend\" (
    echo Starting Frontend on port 3001...
    pushd frontend
    start cmd /k "npx serve -l 3001"
    popd
)

echo Services are starting...
