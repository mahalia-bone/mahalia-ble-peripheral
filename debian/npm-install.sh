#!/usr/bin/env bash

# set home directory (normally /unknown)
export HOME=/tmp/buildd

# set the npm global packages directory
NPMPACKAGES="$HOME/.npm-packages"
mkdir -p $NPMPACKAGES

# install nvm
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh | bash

# load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# install & load node
nvm install v8.11.2
nvm use --delete-prefix v8.11.2

# install npm packages
npm install
