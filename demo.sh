#!/bin/bash
cd "$(dirname "$0")/demo"

if [ ! -d node_modules ]; then
  npm install
fi

npm run dev
