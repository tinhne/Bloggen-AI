const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

// Dynamic import for chalk and ora
let chalk, ora;
(async () => {
  chalk = (await import('chalk')).default;
  ora = (await import('ora')).default;
})();

module.exports = function(program) {
  program
    .command('init')
    .description('Initialize configuration and database connection')
    .option('-f, --force', 'Force overwrite existing configuration', false)
    .action(async (options) => {
      // Ensure chalk and ora are ready to use
      if (!chalk || !ora) {
        chalk = (await import('chalk')).default;
        ora = (await import('ora')).default;
      }

      const spinner = ora('Initializing configuration...').start();
      
      try {
        // Create .env file if it doesn't exist or force is used
        const envPath = path.resolve(process.cwd(), '.env');
        const envExists = fs.existsSync(envPath);
        
        if (envExists && !options.force) {
          spinner.info(chalk.blue('Configuration file already exists. Use --force to overwrite.'));
        } else {
          // Create or overwrite .env file with default configuration
          const defaultEnv = `# Database Configuration
                              DATABASE_URL="postgresql://username:password@localhost:5432/bloggen?schema=public"

                              # API Keys (keep these secure!)
                              GOOGLE_STUDIO_LLM_API_KEY="your_api_key_here"

                              # Server Configuration
                              PORT=3000
                              NODE_ENV=development`;
          
          fs.writeFileSync(envPath, defaultEnv);
          spinner.succeed(chalk.green('Created default configuration file (.env)'));
          console.log(chalk.yellow('IMPORTANT: Update the .env file with your actual database and API credentials.'));
        }
        
        // Test database connection
        spinner.text = 'Testing database connection...';
        
        const prisma = new PrismaClient();
        try {
          // Try to connect to the database
          await prisma.$connect();
          spinner.succeed(chalk.green('Database connection successful'));
          
          // Print database info
          spinner.text = 'Checking database schema...';
          
          // Check if the required tables exist
          const tables = await prisma.$queryRaw`
            SELECT tablename FROM pg_catalog.pg_tables 
            WHERE schemaname='public'
          `;
          
          const tableNames = tables.map(t => t.tablename);
          
          if (tableNames.includes('category') && tableNames.includes('article')) {
            spinner.succeed(chalk.green('Database schema is ready'));
          } else {
            spinner.warn(chalk.yellow('Database schema is not initialized. Run migrations:'));
            console.log(chalk.cyan('  npx prisma migrate dev --name init'));
          }
          
        } catch (dbError) {
          spinner.fail(chalk.red(`Database connection failed: ${dbError.message}`));
          console.log(chalk.yellow('Please check your DATABASE_URL in the .env file.'));
        } finally {
          await prisma.$disconnect();
        }
        
        console.log(chalk.green('\nInitialization completed. You can now use the "bloggen" CLI.'));
        console.log(chalk.cyan('\nExample commands:'));
        console.log(chalk.cyan('  bloggen crawl https://example.com --category="Technology" --style="professional"'));
        console.log(chalk.cyan('  bloggen batch ./urls.csv'));
        console.log(chalk.cyan('  bloggen list'));
        
      } catch (error) {
        spinner.fail(chalk.red(`Initialization failed: ${error.message}`));
      }
    });
};