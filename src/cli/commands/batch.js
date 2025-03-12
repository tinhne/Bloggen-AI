// const ora = require('ora');
// const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const csvService = require('../../services/csv');
// Dynamic import for chalk
let chalk, ora;
(async () => {
  chalk = await import('chalk');
  ora = await import('ora');
})();

module.exports = function(program) {
  program
    .command('batch')
    .description('Process multiple URLs from a CSV file')
    .argument('<csv-file>', 'Path to CSV file with URLs')
    .action(async (csvFile) => {
      // Ensure chalk and ora are ready to use
      if (!chalk || !ora) {
        chalk = (await import('chalk')).default;
        ora = (await import('ora')).default;
      }
      const spinner = ora('Processing CSV file...').start();
      
      try {
        // Validate file path
        const filePath = path.resolve(csvFile);
        if (!fs.existsSync(filePath)) {
          spinner.fail(chalk.red(`File not found: ${filePath}`));
          return;
        }
        
        // Process the CSV file
        spinner.text = 'Processing URLs from CSV...';
        const { results, errors } = await csvService.processCSVFile(filePath);
        
        // Display results
        if (results.length > 0) {
          spinner.succeed(chalk.green(`Successfully processed ${results.length} articles`));
          
          console.log('\n' + chalk.bold('Processed Articles:'));
          results.forEach((article, index) => {
            console.log(chalk.cyan(`\n${index + 1}. ${article.title}`));
            console.log(`   Category ID: ${article.categoryId || 'Unknown'}`);
            console.log(`   URL: ${article.sourceUrl}`);
          });
        } else {
          spinner.warn(chalk.yellow('No articles were successfully processed'));
        }
        
        // Display errors if any
        if (errors.length > 0) {
          console.log('\n' + chalk.red.bold('Errors:'));
          errors.forEach((error, index) => {
            console.log(chalk.red(`\n${index + 1}. Error: ${error.error}`));
            if (error.row) {
              console.log(`   Row data: ${JSON.stringify(error.row)}`);
            }
          });
          
          if (results.length === 0) {
            spinner.fail(chalk.red('All items failed to process'));
          }
        }
        
      } catch (error) {
        spinner.fail(chalk.red(`Error: ${error.message}`));
      }
    });
};