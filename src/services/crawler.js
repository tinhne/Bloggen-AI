// src/services/crawler.js (phiên bản tối ưu)
const axios = require('axios');
const cheerio = require('cheerio');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const cacheService = require('./cache');
const { crawlerRateLimiter } = require('../utils/rateLimiter');
const { URL } = require('url');

class CrawlerService {
  constructor() {
    // Cấu hình timeout và retry
    this.maxRetries = 3;
    this.timeout = 30000; // 30 giây
    
    // Cấu hình User-Agent rotation
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36'
    ];
  }
  
  /**
   * Lấy User-Agent ngẫu nhiên
   * @returns {string} - User-Agent
   */
  getRandomUserAgent() {
    const index = Math.floor(Math.random() * this.userAgents.length);
    return this.userAgents[index];
  }
  
  /**
   * Rút gọn URL thành dạng chuẩn
   * @param {string} url - URL cần chuẩn hóa
   * @returns {string} - URL đã chuẩn hóa
   */
  normalizeUrl(url) {
    try {
      const parsedUrl = new URL(url);
      // Loại bỏ các tham số không cần thiết và fragment
      return `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.pathname}`;
    } catch (error) {
      return url;
    }
  }
  
  // crawl content 
  async crawlUrl(url, retryCount = 0) {
    try {
      // Đợi token từ rate limiter
      await crawlerRateLimiter.acquire();
      
      // Thực hiện request với timeout
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache'
        },
        timeout: this.timeout
      });
      
      const $ = cheerio.load(response.data);
      
      // Cải thiện việc trích xuất nội dung
      const title = this.extractTitle($);
      const content = this.extractContent($);
      
      // Lưu vào cache file
      cacheService.set(url, { title, content });
      
      return { title, content };
    } catch (error) {
      // Retry nếu chưa đạt giới hạn
      if (retryCount < this.maxRetries) {
        console.log(`Retrying URL ${url} (${retryCount + 1}/${this.maxRetries})...`);
        // Chờ trước khi thử lại (1s, 2s, 4s theo cấp số nhân)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        return this.crawlUrl(url, retryCount + 1);
      }
      
      throw new Error(`Error crawling URL ${url}: ${error.message}`);
    }
  }
  
  // get tille
  extractTitle($) {
    // Ưu tiên thẻ h1
    const h1 = $('h1').first().text().trim();
    if (h1 && h1.length > 10) {
      return h1;
    }
    
    // Thử với thẻ title
    const title = $('title').text().trim();
    if (title) {
      // Loại bỏ phần website name nếu có
      const parts = title.split('|');
      if (parts.length > 1) {
        return parts[0].trim();
      }
      return title;
    }
    
    // Thử với thẻ meta
    const metaTitle = $('meta[property="og:title"]').attr('content') || 
                      $('meta[name="twitter:title"]').attr('content');
    
    return metaTitle || 'Untitled';
  }
  
  // get content
  extractContent($) {
    // Các bộ chọn phổ biến cho nội dung chính
    const contentSelectors = [
      'article', 
      '.content', 
      '.post-content', 
      '.entry-content', 
      'main', 
      '.main-content',
      '#content',
      '.article-body',
      '.post-body'
    ];
    
    // Các bộ chọn cần loại bỏ
    const removeSelectors = [
      '.advertisement', 
      '.ads', 
      '.social-share', 
      '.related-posts',
      '.sidebar', 
      '.comments',
      'nav',
      'header',
      'footer',
      'script',
      'style',
      'noscript'
    ];
    
    // Loại bỏ các phần tử không cần thiết
    removeSelectors.forEach(selector => {
      $(selector).remove();
    });
    
    // Tìm nội dung chính
    let content = '';
    let mainContent = null;
    
    // Thử từng bộ chọn cho đến khi tìm được nội dung
    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        const text = element.text().trim();
        if (text.length > 200) {  // Nếu có đủ nội dung
          mainContent = element;
          break;
        }
      }
    }
    
    if (mainContent) {
      // Lấy nội dung từ phần tử chính
      content = mainContent.text().trim();
    } else {
      // Fallback: Thu thập tất cả các đoạn văn
      $('p').each((i, el) => {
        const text = $(el).text().trim();
        if (text.length > 50) {  // Tránh các đoạn quá ngắn
          content += text + '\n\n';
        }
      });
    }
    
    // Nếu vẫn không có nội dung, lấy toàn bộ text của body
    if (!content) {
      content = $('body').text().trim();
    }
    
    // Làm sạch nội dung
    return this.cleanContent(content);
  }
  
  /**
   * Làm sạch nội dung văn bản
   * @param {string} content - Nội dung cần làm sạch
   * @returns {string} - Nội dung đã làm sạch
   */
  cleanContent(content) {
    // Loại bỏ khoảng trắng thừa
    content = content.replace(/\s+/g, ' ');
    
    // Loại bỏ các dòng trống liên tiếp
    content = content.replace(/\n{3,}/g, '\n\n');
    
    // Loại bỏ các ký tự đặc biệt không cần thiết
    content = content.replace(/[^\S\n]+/g, ' ');
    
    return content.trim();
  }
  
  /**
   * Crawl và lưu bài viết với caching
   * @param {string} url - URL cần crawl
   * @param {string} style - Phong cách yêu cầu
   * @param {string} categoryName - Tên danh mục
   * @returns {Promise<object>} - Bài viết đã lưu
   */
  async crawlAndSave(url, style, categoryName) {
    try {
      // Chuẩn hóa URL
      const normalizedUrl = this.normalizeUrl(url);
      
      // Kiểm tra cache
      const cachedData = await cacheService.get(normalizedUrl);
      if (cachedData) {
        if (cachedData.type === 'db') {
          return cachedData.data;
        }
      }
      
      // Lấy hoặc tạo danh mục
      let category = await prisma.category.findUnique({
        where: { name: categoryName }
      });
      
      if (!category) {
        category = await prisma.category.create({
          data: { name: categoryName }
        });
      }
      
      // Crawl nội dung
      const { title, content } = cachedData?.type === 'file' 
        ? cachedData.data 
        : await this.crawlUrl(normalizedUrl);
      
      // Lưu vào database
      const article = await prisma.article.create({
        data: {
          title,
          originalContent: content,
          processedContent: content, // Sẽ được cập nhật sau khi xử lý AI
          sourceUrl: normalizedUrl,
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