#!/bin/bash

# set current working directory to directory of the shell script
cd "$(dirname "$0")"

# before
npm ci 2> /dev/null || npm i
mkdir -p tmp

# domino.min.js
npx rollup --config rollup.mjs --input domino.mjs --file tmp/domino.js
npx terser --compress --mangle -- tmp/domino.js > tmp/domino.min.js

# copy
cp tmp/domino.min.js ../../vendor/

# after
rm -rf node_modules/ tmp/