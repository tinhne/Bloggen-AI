const fs = require('fs');
const csvParser = require('csv-parser');
const { promisify } = require('util');
const path = require('path');
const crawlerService = require('./crawler');
const aiService = require('./ai');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class CSVService {
  /**
   * Process a CSV file with article data
   * @param {string} filePath - Path to the CSV file
   * @returns {Promise<Array>} - Array of processed articles
   */
  async processCSVFile(filePath) {
    const results = [];
    const errors = [];
    
    // Verify file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`CSV file not found: ${filePath}`);
    }
    
    // Verify file is a CSV
    if (path.extname(filePath).toLowerCase() !== '.csv') {
      throw new Error(`File is not a CSV: ${filePath}`);
    }
    
    // Read and parse CSV
    const readCSV = () => {
      return new Promise((resolve, reject) => {
        const data = [];
        fs.createReadStream(filePath)
          .pipe(csvParser())
          .on('data', (row) => data.push(row))
          .on('end', () => resolve(data))
          .on('error', (error) => reject(error));
      });
    };
    
    try {
      const rows = await readCSV();
      
      // Process each row
      for (const row of rows) {
        try {
          // Validate required fields
          const category = row.category || row.Category || '';
          const url = row.url || row.URL || '';
          const style = row.style || row.Style || 'professional and informative';
          
          if (!url) {
            errors.push({ row, error: 'Missing URL' });
            continue;
          }
          
          if (!category) {
            errors.push({ row, error: 'Missing category' });
            continue;
          }
          
          // Crawl and save the article
          const article = await crawlerService.crawlAndSave(url, style, category);
          
          // Process with AI
          const processedArticle = await aiService.processArticle(article.id);
          
          results.push(processedArticle);
        } catch (error) {
          errors.push({ row, error: error.message });
        }
      }
      
      return { results, errors };
    } catch (error) {
      throw new Error(`Error processing CSV file: ${error.message}`);
    }
  }

  async processArticle(article) {
    try {
      // Giả sử bạn có một hàm để xử lý bài viết với AI
      const processedContent = await axios.post('https://api.example.com/process', {
        content: article.originalContent,
        style: article.styleRequest
      });

      // Cập nhật bài viết trong cơ sở dữ liệu
      const updatedArticle = await prisma.article.update({
        where: { id: article.id },
        data: { processedContent: processedContent.data }
      });

      return updatedArticle;
    } catch (error) {
      throw new Error(`Error processing article ID ${article.id}: ${error.message}`);
    }
  }
}

module.exports = new CSVService();