#!/usr/bin/env node

const { program } = require('commander');
// const chalk = require('chalk');
const initCommand = require('./commands/init');
const crawlCommand = require('./commands/crawl');
const batchCommand = require('./commands/batch');
const listCommand = require('./commands/list');
const exportCommand = require('./commands/export');
const scheduleCommand = require('./commands/schedule');
const packageJson = require('../../package.json');

// Dynamic import for chalk
let chalk;
(async () => {
  chalk = await import('chalk');
})();

// Set up CLI program
program
  .name('bloggen')
  .description('CLI to generate blog content from URLs using AI')
  .version(packageJson.version);

// Register commands
initCommand(program);
crawlCommand(program);
batchCommand(program);
listCommand(program);
exportCommand(program);
scheduleCommand(program);

// Handle unknown commands
program.on('command:*', function () {
  console.error(
    chalk.red(`Invalid command: ${program.args.join(' ')}\nSee --help for a list of available commands.`)
  );
  process.exit(1);
});

// Run the program
program.parse(process.argv);

// Show help if no arguments
if (program.args.length === 0) {
  program.help();
}