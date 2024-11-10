#!/bin/bash

# set current working directory to directory of the shell script
cd "$(dirname "$0")"

# before
npm ci 2> /dev/null || npm i

# # turndown.min.js
# npx rollup --config rollup.mjs --input turndown.mjs --file turndown.js

# # Replace the function containing `require` with the async function
# sed -i '/var domino = require('"'"'@mixmark-io\/domino'"'"');/ {
#     N
#     s/var domino = require('"'"'@mixmark-io\/domino'"'"');\n\s*Parser.prototype.parseFromString = function (string) {/Parser.prototype.parseFromString = async function (string) {\n        var domino = await import("\/vendor\/domino.min.js");/
# }' turndown.js

npx terser --compress --mangle -- turndown.js > ../../vendor/turndown.min.js

# after
rm -rf node_modules/