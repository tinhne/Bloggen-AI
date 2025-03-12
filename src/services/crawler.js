const axios = require('axios');
const cheerio = require('cheerio');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class CrawlerService {
  /**
   * Crawl content from a URL
   * @param {string} url - The URL to crawl
   * @returns {Promise<{title: string, content: string}>} - The crawled title and content
   */
  async crawlUrl(url) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Extract title - look for common title elements
      const title = $('h1').first().text().trim() || 
                    $('title').text().trim() || 
                    'Untitled';
      
      // Extract content - focus on main content areas, remove ads, navigation, etc.
      // This is a simplified approach; real implementation would need more refinement
      let content = '';
      
      // Try to find the main content container
      const mainContent = $('article, .content, .post-content, .entry-content, main');
      
      if (mainContent.length > 0) {
        // Use the first matching content container
        content = mainContent.first().text().trim();
      } else {
        // Fallback to extract paragraphs
        $('p').each((i, el) => {
          const text = $(el).text().trim();
          if (text.length > 50) { // Avoid short paragraphs that might be captions
            content += text + '\n\n';
          }
        });
      }
      
      return {
        title: title,
        content: content || 'No content found'
      };
    } catch (error) {
      throw new Error(`Error crawling URL ${url}: ${error.message}`);
    }
  }
  
  /**
   * Crawl a URL and save it to the database
   * @param {string} url - The URL to crawl
   * @param {string} style - The requested style
   * @param {string} categoryName - The category name
   * @returns {Promise<object>} - The created article
   */
  async crawlAndSave(url, style, categoryName) {
    try {
      // Get or create category
      let category = await prisma.category.findUnique({
        where: { name: categoryName }
      });
      
      if (!category) {
        category = await prisma.category.create({
          data: { name: categoryName }
        });
      }
      
      // Check if the article with the same URL already exists
      const existingArticle = await prisma.article.findFirst({
        where: { sourceUrl: url }
      });
      
      if (existingArticle) {
        return existingArticle;
      }
      
      // Crawl the URL
      const { title, content } = await this.crawlUrl(url);
      
      // Save to database (without AI processing for now)
      const article = await prisma.article.create({
        data: {
          title,
          originalContent: content,
          processedContent: content, // Will be updated after AI processing
          sourceUrl: url,
          styleRequest: style,
          categoryId: category.id
        }
      });
      
      return article;
    } catch (error) {
      throw new Error(`Error processing URL ${url}: ${error.message}`);
    }
  }
}

module.exports = new CrawlerService();