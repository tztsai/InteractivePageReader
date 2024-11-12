#!/bin/bash

# set current working directory to directory of the shell script
cd "$(dirname "$0")"

# before
# npm ci 2> /dev/null || npm i

# # turndown.min.js
# npx rollup --config rollup.mjs --input turndown.mjs --file turndown.js

# FIXIT: replace domino require with import
# awk '/var domino = require('\''@mixmark-io\/domino'\'');/ {
#     printf "%s\n", $0
#     getline
#     printf "Parser.prototype.parseFromString = async function (string) {\n"
#     printf "        var domino = await import(\"\/vendor\/domino.min.js\");\n"
#     next
# } { print }' turndown.js > turndown_temp.js && mv turndown_temp.js turndown.js

npx terser --compress --mangle -- turndown.js > ../../vendor/turndown.min.js

# after
# rm -rf node_modules/
