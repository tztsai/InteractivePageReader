#!/bin/bash

# set current working directory to directory of the shell script
cd "$(dirname "$0")"

# before
npm ci 2> /dev/null || npm i
mv node_modules/webextension-polyfill/dist/browser-polyfill.min.js ../../vendor/

# # after
rm -rf node_modules/