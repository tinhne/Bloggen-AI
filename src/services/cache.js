// src/services/cache.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class CacheService {
  constructor() {
    // Đảm bảo thư mục cache tồn tại
    this.cacheDir = path.resolve(process.cwd(), '.cache');
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }
  
  // tạo key
  generateKey(url) {
    return crypto.createHash('md5').update(url).digest('hex');
  }
  
  //  Kiểm tra bài viết có trong cache không (cả DB và file)

  async get(url) {
    try {
      // 1Kiểm tra trong file cache trước
      const cacheKey = this.generateKey(url);
      const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);
  
      if (fs.existsSync(cachePath)) {
        const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        const cacheAge = Date.now() - cacheData.timestamp;
  
        // Nếu cache còn hợp lệ (dưới 24h)
        if (cacheAge < 24 * 60 * 60 * 1000) {
          return { 
            type: 'file', 
            data: cacheData.data 
          };
        } else {
          // Xóa cache file đã hết hạn
          fs.unlinkSync(cachePath);
        }
      }
  
      // Nếu không có trong file cache, kiểm tra database
      const article = await prisma.article.findFirst({
        where: { sourceUrl: url },
        include: { category: true }
      });
  
      if (article) {
        return { 
          type: 'db', 
          data: article 
        };
      }
  
      // Không tìm thấy trong cache & DB
      return null;
    } catch (error) {
      console.error('Cache error:', error);
      return null;
    }
  }
  
  
  // Lưu dữ liệu vào cache
  set(url, data) {
    try {
      const cacheKey = this.generateKey(url);
      const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);
      
      const cacheData = {
        timestamp: Date.now(),
        url,
        data
      };
      
      fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      console.error('Cache write error:', error);
    }
  }
  
  //xoa cache
  invalidate(url) {
    try {
      const cacheKey = this.generateKey(url);
      const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);
      
      if (fs.existsSync(cachePath)) {
        fs.unlinkSync(cachePath);
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }
  
  // delete all
  clear() {
    try {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.cacheDir, file));
      }
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }
}

module.exports = new CacheService();