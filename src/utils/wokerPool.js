const os = require('os');
const { createUrlProcessor } = require('./worker');

class WorkerPool {
  constructor(maxWorkers = null) {
    // Mặc định sử dụng số lõi CPU - 1 hoặc ít nhất 1 worker
    this.maxWorkers = maxWorkers || Math.max(1, os.cpus().length - 1);
    this.activeWorkers = 0;
    this.queue = [];
  }
  
  async addTask(url, style, category) {
    return new Promise((resolve, reject) => {
      const task = { url, style, category, resolve, reject };
      
      // Thêm task vào hàng đợi
      this.queue.push(task);
      
      // Cố gắng xử lý task ngay lập tức nếu có thể
      this.processQueue();
    });
  }
  
  async processQueue() {
    // Kiểm tra nếu đã đạt số worker tối đa hoặc không có công việc trong hàng đợi
    if (this.activeWorkers >= this.maxWorkers || this.queue.length === 0) {
      return;
    }
    
    // Lấy công việc từ hàng đợi
    const task = this.queue.shift();
    this.activeWorkers++;
    
    try {
      // Xử lý URL trong worker thread riêng biệt
      const result = await createUrlProcessor(task.url, task.style, task.category);
      task.resolve(result);
    } catch (error) {
      task.reject(error);
    } finally {
      // Giảm số worker đang hoạt động và kiểm tra hàng đợi
      this.activeWorkers--;
      this.processQueue();
    }
  }
  
  async processUrls(urlsData) {
    // Xử lý nhiều URL cùng lúc
    const results = [];
    const errors = [];
    
    // Thêm tất cả URL vào hàng đợi và thu thập kết quả
    const promises = urlsData.map(async ({ url, style, category }) => {
      try {
        const result = await this.addTask(url, style, category);
        if (result.success) {
          results.push(result.article);
        } else {
          errors.push({ url, error: result.message });
        }
      } catch (error) {
        errors.push({ url, error: error.message });
      }
    });
    
    // Đợi tất cả các URL được xử lý
    await Promise.all(promises);
    
    return { results, errors };
  }
}

module.exports = new WorkerPool();
