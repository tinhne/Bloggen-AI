// const ora = require('ora');
// const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const csvService = require('../../services/csv');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
// Dynamic import for chalk
let chalk, ora;
(async () => {
  chalk = await import('chalk');
  ora = await import('ora');
})();

module.exports = function(program) {
  program
    .command('list')
    .description('List all articles from the database')
    .action(async () => {
      if(!chalk || !ora) {
        chalk = (await import('chalk')).default;
        ora = (await import('ora')).default;
      }
      const spinner = ora('Fetch articles from database...').start();
      
      try {
        const articles = await prisma.article.findMany({
          include: {
            category: true
          }
        });

        // Display results
        if (articles.length > 0) {
          spinner.succeed(chalk.green(`Successfully processed ${articles.length} articles`));
          
          console.log('\n' + chalk.bold('Processed Articles:'));
          articles.forEach((article, index) => {
            console.log(chalk.cyan(`\n${index + 1}. ${article.title}`));
            console.log(`   Category: ${article.category?.name || 'Unknown'}`);
            console.log(`   URL: ${article.sourceUrl}`);
          });
        } else {
          spinner.warn(chalk.yellow('No articles were successfully processed'));
        }
        
      } catch (error) {
        spinner.fail(chalk.red(`Error: ${error.message}`));
      }
    });
};