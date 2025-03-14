const puppeteer = require('puppeteer');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const cacheService = require('./cache');
const { crawlerRateLimiter } = require('../utils/rateLimiter');
const { URL } = require('url');

// // Đóng kết nối Redis khi tiến trình kết thúc
// process.on('exit', () => {
//   cacheService.redis.quit();
// });

class CrawlerService {
  constructor() {
    this.maxRetries = 3;
    this.timeout = 30000;
  }

  normalizeUrl(url) {
    try {
      const parsedUrl = new URL(url);
      return `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.pathname}`;
    } catch (error) {
      return url;
    }
  }

  async crawlUrl(url, retryCount = 0) {
    try {
      await crawlerRateLimiter.acquire();
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.timeout });
      
      const title = await page.evaluate(() => {
        return document.querySelector('h1')?.innerText || document.title || 'Untitled';
      });
      
      const content = await page.evaluate(() => {
        const removeSelectors = ['script', 'style', 'noscript', 'header', 'footer', 'nav', '.ads', '.comments', '.sidebar'];
        removeSelectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => el.remove());
        });
        return document.body.innerText.trim();
      });
      
      await browser.close();
      // save to cache
      await cacheService.set(url, { title, content });

      return { title, content };
    } catch (error) {
      if (retryCount < this.maxRetries) {
        console.log(`Retrying URL ${url} (${retryCount + 1}/${this.maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        return this.crawlUrl(url, retryCount + 1);
      }
      throw new Error(`Error crawling URL ${url}: ${error.message}`);
    }
  }

  async crawlAndSave(url, style, categoryName) {
    try {
      const normalizedUrl = this.normalizeUrl(url);
      // check cache 
      const cachedData = await cacheService.get(normalizedUrl);
      if (cachedData) {
        console.log(`Cache hit from ${cachedData.type} for: ${normalizedUrl}`);
        if (cachedData.type === 'redis') {
          return cachedData.data; // Trả về dữ liệu từ Redis cache
        }
      }
      
      // check db
      let category = await prisma.category.findUnique({ where: { name: categoryName } });
      if (!category) {
        category = await prisma.category.create({ data: { name: categoryName } });
      }
      
      // check file
      const { title, content } = cachedData?.type === 'file' 
        ? cachedData.data 
        : await this.crawlUrl(normalizedUrl);
      
      const article = await prisma.article.create({
        data: {
          title,
          originalContent: content,
          processedContent: content,
          sourceUrl: normalizedUrl,
          styleRequest: style,
          categoryId: category.id
        }
      });
      console.log("Saved article:", article); // Kiểm tra ID của bài viết

      
      return article;
    } catch (error) {
      throw new Error(`Error processing URL ${url}: ${error.message}`);
    }
  }
}

module.exports = new CrawlerService();