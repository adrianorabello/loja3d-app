#!/usr/bin/env node

// Angular CLI 11 builds on webpack 4, which hashes modules with MD4.
// OpenSSL 3 (Node 17+) dropped MD4 from its default provider, so the build
// needs --openssl-legacy-provider there. Node 16 ships OpenSSL 1.1, does not
// need the flag, and *rejects* it in NODE_OPTIONS -- so it must be set
// conditionally rather than hardcoded in the npm scripts.
//
// This also invokes the project's own CLI (@angular/cli 11.2.11) with the
// current node binary, bypassing any global or asdf-shimmed `ng`.

const { spawn } = require('child_process');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const env = { ...process.env };

if (parseInt(process.versions.openssl, 10) >= 3) {
    env.NODE_OPTIONS = `${env.NODE_OPTIONS || ''} --openssl-legacy-provider`.trim();
}

// Resolve the CLI's entry point from its own package.json `bin` field: it is
// bin/ng in v11 but bin/ng.js in newer majors.
const cliManifest = require.resolve('@angular/cli/package.json', { paths: [projectRoot] });
const ng = path.join(path.dirname(cliManifest), require(cliManifest).bin.ng);

spawn(process.execPath, [ng, ...process.argv.slice(2)], { stdio: 'inherit', env })
    .on('error', (err) => {
        console.error(err.message);
        process.exit(1);
    })
    .on('exit', (code) => process.exit(code === null ? 1 : code));
