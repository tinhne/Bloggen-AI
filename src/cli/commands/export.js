const fs = require('fs');
const path = require('path');
// const ora = require('ora');
// const chalk = require('chalk');
const databaseService = require('../../services/database');
// Dynamic import for chalk
let chalk, ora;
(async () => {
  chalk = await import('chalk');
  ora = await import('ora');
})();

module.exports = function(program) {
  program
    .command('export')
    .description('Export articles to file')
    .option('-f, --format <format>', 'Output format (json, md, html)', 'json')
    .option('-o, --output <path>', 'Output file path', './export')
    .option('-c, --category <id>', 'Filter by category ID')
    .option('-i, --id <id>', 'Export specific article ID')
    .action(async (options) => {
      // Ensure chalk and ora are ready to use
      if (!chalk || !ora) {
        chalk = (await import('chalk')).default;
        ora = (await import('ora')).default;
      }
      const spinner = ora('Preparing data for export...').start();
      
      try {
        let data;
        let filename;
        
        // Fetch data based on options
        if (options.id) {
          // Export single article
          const article = await databaseService.getArticleById(parseInt(options.id));
          
          if (!article) {
            spinner.fail(chalk.red(`Article with ID ${options.id} not found`));
            return;
          }
          
          data = [article];
          filename = `article_${article.id}`;
        } else {
          // Export all articles (with optional category filter)
          const result = await databaseService.searchArticles(
            '', 
            options.category ? parseInt(options.category) : null,
            1, 
            1000 // Limit to 1000 articles at a time
          );
          
          if (result.data.length === 0) {
            spinner.fail(chalk.red('No articles found for export'));
            return;
          }
          
          data = result.data;
          filename = options.category 
            ? `category_${options.category}_articles` 
            : 'all_articles';
        }
        
        spinner.succeed(chalk.green(`Found ${data.length} articles to export`));
        spinner.start('Formatting data...');
        
        // Format data based on selected format
        let formattedContent;
        
        switch (options.format.toLowerCase()) {
          case 'json':
            formattedContent = JSON.stringify(data, null, 2);
            filename += '.json';
            break;
            
          case 'md':
            formattedContent = formatMarkdown(data);
            filename += '.md';
            break;
            
          case 'html':
            formattedContent = formatHtml(data);
            filename += '.html';
            break;
            
          default:
            spinner.fail(chalk.red(`Unsupported format: ${options.format}`));
            return;
        }
        
        // Create output directory if it doesn't exist
        const outputDir = path.resolve(options.output);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Write to file
        const outputPath = path.join(outputDir, filename);
        fs.writeFileSync(outputPath, formattedContent);
        
        spinner.succeed(chalk.green(`Export completed: ${outputPath}`));
        
      } catch (error) {
        spinner.fail(chalk.red(`Export failed: ${error.message}`));
      }
    });
};

// Helper function to format articles as Markdown
function formatMarkdown(articles) {
  return articles.map(article => {
    return `# ${article.title}\n\n` +
           `Category: ${article.category.name}\n\n` +
           `Source: ${article.sourceUrl}\n\n` +
           `Date: ${article.createdAt.toISOString().split('T')[0]}\n\n` +
           `${article.processedContent}\n\n` +
           `---\n\n`;
  }).join('');
}

// Helper function to format articles as HTML
function formatHtml(articles) {
  const articlesHtml = articles.map(article => {
    return `
      <article>
        <h1>${article.title}</h1>
        <div class="meta">
          <p>Category: ${article.category.name}</p>
          <p>Source: <a href="${article.sourceUrl}" target="_blank">${article.sourceUrl}</a></p>
          <p>Date: ${article.createdAt.toISOString().split('T')[0]}</p>
        </div>
        <div class="content">
          ${article.processedContent}
        </div>
      </article>
      <hr>
    `;
  }).join('');
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Exported Articles</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
        article { margin-bottom: 30px; }
        h1 { color: #333; }
        .meta { color: #666; font-size: 0.9em; }
        .content { margin-top: 20px; }
        hr { border: 0; border-top: 1px solid #eee; margin: 30px 0; }
      </style>
    </head>
    <body>
      <h1>Exported Articles</h1>
      ${articlesHtml}
    </body>
    </html>
  `;
}