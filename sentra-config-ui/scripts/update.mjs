#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import ora from 'ora';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root directory is one level up from sentra-config-ui
const ROOT_DIR = path.resolve(__dirname, '..', '..');

const args = process.argv.slice(2);
const isForce = args.includes('force') || args.includes('--force');

console.log(chalk.blue.bold('\n🔄 Sentra Agent Update Script\n'));
console.log(chalk.gray(`Root Directory: ${ROOT_DIR}`));
console.log(chalk.gray(`Update Mode: ${isForce ? 'FORCE' : 'NORMAL'}\n`));

function exists(p) {
    try {
        fs.accessSync(p);
        return true;
    } catch {
        return false;
    }
}

function getFileHash(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return crypto.createHash('md5').update(content).digest('hex');
    } catch {
        return null;
    }
}

function listSentraSubdirs(root) {
    const out = [];
    try {
        const entries = fs.readdirSync(root, { withFileTypes: true });
        for (const e of entries) {
            if (e.isDirectory() && e.name.startsWith('sentra-')) {
                out.push(path.join(root, e.name));
            }
        }
    } catch {
        // Ignore errors
    }
    return out;
}

function isNodeProject(dir) {
    return exists(path.join(dir, 'package.json'));
}

function listNestedNodeProjects(dir) {
    const results = [];
    let entries = [];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return results;
    }
    for (const e of entries) {
        if (!e.isDirectory()) continue;
        const name = e.name;
        if (name === 'node_modules' || name.startsWith('.')) continue;
        const sub = path.join(dir, name);
        if (isNodeProject(sub)) results.push(sub);
    }
    return results;
}

function collectAllNodeProjects() {
    const projects = new Set();
    const uiDir = path.resolve(ROOT_DIR, 'sentra-config-ui');

    // Add root and UI directory
    if (isNodeProject(ROOT_DIR)) projects.add(ROOT_DIR);
    if (isNodeProject(uiDir)) projects.add(uiDir);

    // Add all sentra-* directories
    for (const dir of listSentraSubdirs(ROOT_DIR)) {
        if (isNodeProject(dir)) projects.add(dir);
        // Also include one-level nested Node projects
        for (const nested of listNestedNodeProjects(dir)) {
            projects.add(nested);
        }
    }

    return Array.from(projects);
}

function resolveMirrorProfileDefaults() {
    const profile = String(process.env.MIRROR_PROFILE || '').toLowerCase();
    const isChina = profile === 'china' || profile === 'cn' || profile === 'tsinghua' || profile === 'npmmirror' || profile === 'taobao';
    return {
        npmRegistryDefault: isChina ? 'https://registry.npmmirror.com/' : '',
    };
}

function resolveNpmRegistry() {
    const { npmRegistryDefault } = resolveMirrorProfileDefaults();
    return (
        process.env.NPM_REGISTRY ||
        process.env.NPM_CONFIG_REGISTRY ||
        process.env.npm_config_registry ||
        npmRegistryDefault ||
        ''
    );
}

async function execCommand(command, args, cwd, extraEnv = {}) {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args, {
            cwd,
            stdio: 'inherit',
            shell: true,
            env: {
                ...process.env,
                ...extraEnv,
                FORCE_COLOR: '3',
            }
        });

        proc.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with exit code ${code}`));
            }
        });

        proc.on('error', reject);
    });
}

async function update() {
    const spinner = ora();

    try {
        // Step 1: Get package.json hashes before update
        console.log(chalk.cyan('📦 Detecting package.json files...\n'));
        const projects = collectAllNodeProjects();
        const beforeHashes = new Map();

        for (const dir of projects) {
            const pkgPath = path.join(dir, 'package.json');
            const hash = getFileHash(pkgPath);
            const label = path.relative(ROOT_DIR, dir) || '.';
            beforeHashes.set(dir, hash);
            console.log(chalk.gray(`  Found: ${label}`));
        }
        console.log();

        // Step 2: Git operations
        if (isForce) {
            console.log(chalk.yellow.bold('⚠️  Force Update Mode - This will discard local changes!\n'));

            spinner.start('Fetching latest changes...');
            await execCommand('git', ['fetch', '--all'], ROOT_DIR);
            spinner.succeed('Fetched latest changes');

            spinner.start('Resetting to origin/main...');
            await execCommand('git', ['reset', '--hard', 'origin/main'], ROOT_DIR);
            spinner.succeed('Reset to origin/main');
        } else {
            spinner.start('Checking for updates...');
            await execCommand('git', ['fetch'], ROOT_DIR);
            spinner.succeed('Checked for updates');

            spinner.start('Pulling latest changes...');
            await execCommand('git', ['pull'], ROOT_DIR);
            spinner.succeed('Pulled latest changes');
        }

        // Step 3: Check which projects need dependency installation
        console.log(chalk.cyan('\n🔍 Checking for dependency changes...\n'));
        const projectsToInstall = [];

        for (const dir of projects) {
            const label = path.relative(ROOT_DIR, dir) || '.';
            const pkgPath = path.join(dir, 'package.json');
            const nmPath = path.join(dir, 'node_modules');

            // Check if node_modules exists
            if (!exists(nmPath)) {
                console.log(chalk.yellow(`  ${label}: node_modules missing → will install`));
                projectsToInstall.push({ dir, label, reason: 'missing node_modules' });
                continue;
            }

            // Check if package.json changed
            const beforeHash = beforeHashes.get(dir);
            const afterHash = getFileHash(pkgPath);

            if (beforeHash !== afterHash) {
                console.log(chalk.yellow(`  ${label}: package.json changed → will install`));
                projectsToInstall.push({ dir, label, reason: 'package.json changed' });
            } else {
                console.log(chalk.gray(`  ${label}: no changes → skip`));
            }
        }

        // Step 4: Install dependencies for projects that need it
        if (projectsToInstall.length > 0) {
            console.log(chalk.cyan(`\n📥 Installing dependencies for ${projectsToInstall.length} project(s)...\n`));
            const npmRegistry = resolveNpmRegistry();

            for (const { dir, label, reason } of projectsToInstall) {
                spinner.start(`Installing ${label} (${reason})...`);
                try {
                    const env = {};
                    if (npmRegistry) {
                        env.npm_config_registry = npmRegistry;
                        env.NPM_CONFIG_REGISTRY = npmRegistry;
                    }
                    await execCommand('npm', ['install'], dir, env);
                    spinner.succeed(`Installed ${label}`);
                } catch (error) {
                    spinner.fail(`Failed to install ${label}`);
                    throw error;
                }
            }
        } else {
            console.log(chalk.green('\n✨ No dependency changes detected, skipping installation\n'));
        }

        console.log(chalk.green.bold('\n✅ Update completed successfully!\n'));
        process.exit(0);
    } catch (error) {
        spinner.fail('Update failed');
        console.error(chalk.red('\n❌ Error:'), error.message);
        process.exit(1);
    }
}

update();
