const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');
const crawlerService = require('../services/crawler');
const aiService = require('../services/ai');
const { PrismaClient } = require('@prisma/client');

if (!isMainThread) {
  // Mã thực thi trong worker thread
  const { url, style, category } = workerData;
  
  async function processUrl() {
    try {
      const prisma = new PrismaClient();
      
      // Kiểm tra trong cache trước khi crawl
      const existingArticle = await prisma.article.findFirst({
        where: { sourceUrl: url }
      });
      
      if (existingArticle) {
        await prisma.$disconnect();
        parentPort.postMessage({ 
          success: true, 
          message: 'Bài viết đã tồn tại trong cơ sở dữ liệu', 
          article: existingArticle 
        });
        return;
      }
      
      // Crawl URL và lưu vào database
      const article = await crawlerService.crawlAndSave(url, style, category);
      
      // Xử lý bài viết với AI
      const processedArticle = await aiService.processArticle(article.id);
      
      await prisma.$disconnect();
      parentPort.postMessage({ 
        success: true, 
        message: 'Xử lý thành công', 
        article: processedArticle 
      });
    } catch (error) {
      parentPort.postMessage({ 
        success: false, 
        message: `Lỗi: ${error.message}`
      });
    }
  }
  
  processUrl();
}

// Hàm để tạo worker mới
function createUrlProcessor(url, style, category) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: { url, style, category }
    });
    
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}

module.exports = { createUrlProcessor };