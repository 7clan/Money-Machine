#!/bin/bash
# Detached dev launcher — survives parent shell exit via double-fork + setsid
cd /home/z/my-project

# Kill any leftover dev server
pkill -f "next dev -p 3000" 2>/dev/null
pkill -f "next-server" 2>/dev/null
sleep 1

# Truncate log
> /home/z/my-project/dev.log

# Start next dev in a new session, fully detached
nohup setsid bash -c '
  cd /home/z/my-project
  exec node_modules/.bin/next dev -p 3000
' > /home/z/my-project/dev.log 2>&1 < /dev/null &

PID=$!
disown $PID 2>/dev/null
echo "$PID" > /home/z/my-project/.zscripts/dev.pid
echo "Started detached dev server, PID=$PID"
