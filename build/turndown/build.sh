#!/bin/bash

# set current working directory to directory of the shell script
cd "$(dirname "$0")"

# before
npm ci 2> /dev/null || npm i
mkdir -p tmp

# turndown.min.js
npx rollup --config rollup.mjs --input turndown.mjs --file tmp/turndown.js
# npx browserify tmp/turndown.js > tmp/turndown.js
npx terser --compress --mangle -- tmp/turndown.js > tmp/turndown.min.js

# copy
cp tmp/turndown.min.js ../../vendor/

# after
rm -rf node_modules/ tmp/