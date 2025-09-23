// scripts/create-client-entry.cjs
const fs = require("fs");
const path = require("path");

const distRoot = path.resolve(__dirname, "../dist");
const esmWrapperPath = path.join(distRoot, "index.esm.mjs");

const content = `'use client';

import { EventBus, PlayerProvider, VideoPlayer, reduce, usePlayerDeps, usePlayerMachine } from './index.js';

export { EventBus, PlayerProvider, VideoPlayer, reduce, usePlayerDeps, usePlayerMachine };

export default VideoPlayer;
`;

fs.mkdirSync(distRoot, { recursive: true });
fs.writeFileSync(esmWrapperPath, content, { encoding: "utf8" });
console.log("Created client ESM wrapper at", esmWrapperPath);
