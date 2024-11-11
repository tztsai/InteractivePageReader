#!/bin/bash

# set current working directory to directory of the shell script
cd "$(dirname "$0")"

# before
npm ci 2> /dev/null || npm i
# mkdir -p tmp

# readability.min.js
# cp node_modules/@mozilla/readability/Readability.js tmp/readability.js
# npx terser --compress --mangle -- tmp/readability.js > tmp/readability.min.js

# copy
# cp tmp/readability.min.js ../../vendor/
mv node_modules/@mozilla/readability/Readability.js ../../vendor/readability.min.js

# after
rm -rf node_modules/