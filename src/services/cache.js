const Redis = require('ioredis');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

class CacheService {
  constructor() {
    this.redis = new Redis({
      host: '127.0.0.1', 
      port: 6379
    });

    this.redis.on('error', (err) => {
      console.error('Redis Error:', err);
    });
  }

  // Tạo key bằng hash MD5 từ URL
  generateKey(url) {
    return crypto.createHash('md5').update(url).digest('hex');
  }

  // Kiểm tra bài viết có trong cache (Redis hoặc DB)
  async get(url) {
    try {
      const cacheKey = this.generateKey(url);

      //  Kiểm tra trong Redis
      const cacheData = await this.redis.get(cacheKey);
      if (cacheData) {
        console.log("Cache hit:", JSON.parse(cacheData));
        return { type: 'redis', data: JSON.parse(cacheData) };
      }

      // Nếu không có trong Redis, kiểm tra trong database
      const article = await prisma.article.findFirst({
        where: { sourceUrl: url },
        include: { category: true }
      });

      if (article) {
        return { type: 'db', data: article };
      }

      //  Không tìm thấy
      return null;
    } catch (error) {
      console.error('Cache error:', error);
      return null;
    }
  }

  // Lưu dữ liệu vào Redis (với TTL = 24h)
  async set(url, data) {
    try {
      const cacheKey = this.generateKey(url);
      await this.redis.set(cacheKey, JSON.stringify(data), 'EX', 24 * 60 * 60);
    } catch (error) {
      console.error('Redis SET error:', error);
    }
  }

  // Xóa cache theo URL
  async invalidate(url) {
    try {
      const cacheKey = this.generateKey(url);
      await this.redis.del(cacheKey);
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  // Xóa toàn bộ cache Redis
  async clear() {
    try {
      await this.redis.flushall();
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }
  
}


module.exports = new CacheService();
