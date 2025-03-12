const fs = require('fs');
const csvParser = require('csv-parser');
const path = require('path');
const workerPool = require('../utils/wokerPool');
const cacheService = require('./cache');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class CSVService {
  // Process csv
  async processCSVFile(filePath) {
    // Verify exists and is CSV
    if (!fs.existsSync(filePath)) {
      throw new Error(`CSV file not found: ${filePath}`);
    }
    
    if (path.extname(filePath).toLowerCase() !== '.csv') {
      throw new Error(`File is not a CSV: ${filePath}`);
    }
    
    // đọc and parse CSV
    const rows = await new Promise((resolve, reject) => {
      const data = [];
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (row) => data.push(row))
        .on('end', () => resolve(data))
        .on('error', (error) => reject(error));
    });
    
    // Chuẩn bị dữ liệu cho worker pool
    const urlsData = rows.map(row => {
      return {
        url: row.url || row.URL || '',
        style: row.style || row.Style || 'professional and informative',
        category: row.category || row.Category || 'Uncategorized'
      };
    });
    
    // Lọc dữ liệu không hợp lệ
    const validUrlsData = urlsData.filter(data => {
      return data.url && data.url.trim() !== '';
    });
    
    // Xử lý song song với worker pool
    const { results, errors } = await workerPool.processUrls(validUrlsData);
    
    return { results, errors };
  }
}

module.exports = new CSVService();