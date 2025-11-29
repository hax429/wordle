#!/bin/bash
export NVM_DIR="/home/opc/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /home/opc/services/wordle
exec node server/index.js
