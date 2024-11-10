#!/bin/bash

# set current working directory to directory of the shell script
cd "$(dirname "$0")"

# before
npm ci 2> /dev/null || npm i
mkdir -p tmp

# readability.min.js
npx rollup --config rollup.mjs --input readability.mjs --file tmp/readability.js
npx terser --compress --mangle -- tmp/readability.js > tmp/readability.min.js

# copy
cp tmp/readability.min.js ../../vendor/

# after
rm -rf node_modules/ tmp/