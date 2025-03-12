const fs = require('fs');
const path = require('path');
// const chalk = require('chalk');
// const ora = require('ora');
const cron = require('node-cron');
const csvService = require('../../services/csv');
// Dynamic import for chalk
let chalk, ora;
(async () => {
  chalk = await import('chalk');
  ora = await import('ora');
})();

module.exports = function(program) {
  program
    .command('schedule')
    .description('Schedule automatic crawling tasks')
    .option('-c, --cron <expression>', 'Cron expression (e.g. "0 0 * * *" for daily at midnight)', '0 0 * * *')
    .option('-f, --file <path>', 'Path to CSV file with URLs', './urls.csv')
    .option('-o, --once', 'Run once immediately then exit', false)
    .action(async (options) => {
      // Ensure chalk and ora are ready to use
      if (!chalk || !ora) {
        chalk = (await import('chalk')).default;
        ora = (await import('ora')).default;
      }
      // Validate file path
      const filePath = path.resolve(options.file);
      if (!fs.existsSync(filePath)) {
        console.error(chalk.red(`CSV file not found: ${filePath}`));
        return;
      }
      
      // Validate cron expression
      if (!cron.validate(options.cron)) {
        console.error(chalk.red(`Invalid cron expression: ${options.cron}`));
        return;
      }
      
      // Display schedule information
      console.log(chalk.cyan('Scheduling crawler task:'));
      console.log(`CSV File: ${chalk.yellow(filePath)}`);
      console.log(`Cron Schedule: ${chalk.yellow(options.cron)}`);
      
      // Function to run the crawling task
      const runCrawlTask = async () => {
        const spinner = ora('Starting scheduled crawl...').start();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        try {
          spinner.text = 'Processing URLs from CSV...';
          const { results, errors } = await csvService.processCSVFile(filePath);
          
          // Log results
          spinner.succeed(chalk.green(`Completed scheduled crawl at ${new Date().toLocaleString()}`));
          console.log(`Processed ${results.length} articles successfully`);
          
          if (errors.length > 0) {
            console.log(chalk.yellow(`Encountered ${errors.length} errors`));
          }
          
          // Write log file
          const logDir = path.resolve('./logs');
          if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
          }
          
          const logFile = path.join(logDir, `crawl-${timestamp}.log`);
          const logContent = `
Crawl Report - ${new Date().toLocaleString()}
-------------------------------------------
CSV File: ${filePath}
Successful: ${results.length}
Errors: ${errors.length}

Processed Articles:
${results.map(a => `- ${a.title} (ID: ${a.id})`).join('\n')}

${errors.length > 0 ? `Errors:
${errors.map(e => `- ${JSON.stringify(e)}`).join('\n')}` : ''}
`;
          
          fs.writeFileSync(logFile, logContent);
          console.log(chalk.cyan(`Log saved to: ${logFile}`));
          
        } catch (error) {
          spinner.fail(chalk.red(`Scheduled crawl failed: ${error.message}`));
        }
      };
      
      // Run once immediately if requested
      if (options.once) {
        await runCrawlTask();
        return;
      }
      
      // Schedule the task
      console.log(chalk.green('\nTask scheduled. Press Ctrl+C to exit.'));
      console.log(chalk.yellow('First execution will occur at the next scheduled time.'));
      
      // Start the cron job
      cron.schedule(options.cron, runCrawlTask);
    });
};