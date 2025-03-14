const crawlerService = require('../../services/crawler');
const aiService = require('../../services/ai');

// Dynamic import for chalk
let chalk, ora;
(async () => {
  chalk = await import('chalk');
  ora = await import('ora');
})();

module.exports = function(program) {
  program
    .command('crawl')
    .description('Crawl and process a single URL')
    .argument('<url>', 'URL to crawl')
    .option('-s, --style <style>', 'Content style to apply', 'professional and informative')
    .option('-c, --category <category>', 'Category name', 'Uncategorized')
    .action(async (url, options) => {
      // Ensure chalk and ora are ready to use
      if (!chalk || !ora) {
        chalk = (await import('chalk')).default;
        ora = (await import('ora')).default;
      }
      const spinner = ora('Crawling URL...').start();
      
      try {
        // Validate URL
        try {
          new URL(url); // Will throw if invalid
        } catch (e) {
          spinner.fail(chalk.red('Invalid URL provided'));
          return;
        }
        
        // Crawl and save the URL
        spinner.text = 'Crawling and saving content...';
        const article = await crawlerService.crawlAndSave(
          url, 
          options.style, 
          options.category
        );
        console.log("DEBUG - Crawled Article:", article); // Check if article has an ID
        // Nếu article không có ID, báo lỗi
if (!article || !article.id) {
  spinner.fail(chalk.red('Crawled article is invalid or missing ID'));
  return;
}
        // Process with AI
        spinner.text = 'Processing content with AI...';
        try {
          const processedArticle = await aiService.processArticle(article.id);
          
          spinner.succeed(chalk.green('URL successfully processed'));
          
          // Display results
          console.log('\n' + chalk.bold('Article Details:'));
          console.log(chalk.cyan('ID:'), processedArticle.id);
          console.log(chalk.cyan('Title:'), processedArticle.title);
          console.log(chalk.cyan('Category:'), options.category);
          console.log(chalk.cyan('URL:'), processedArticle.sourceUrl);
          console.log(chalk.cyan('Style:'), processedArticle.styleRequest);
          
          // Show content preview
          const preview = processedArticle.processedContent.substring(0, 2000) + '...';
          console.log(chalk.cyan('\nContent Preview:'));
          console.log(preview);
        } catch (aiError) {
          spinner.fail(chalk.red(`Error processing article ID ${article.id}: ${aiError.message}`));
          if (aiError.response && aiError.response.data) {
            console.error(chalk.red(`API response: ${JSON.stringify(aiError.response.data, null, 2)}`));
          } else {
            console.error(chalk.red(`Error details: ${aiError.message}`));
          }
        }
        
      } catch (error) {
        spinner.fail(chalk.red(`Error: ${error.message}`));
      }
    });
};