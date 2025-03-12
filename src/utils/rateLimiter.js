class RateLimiter {
    constructor(maxRequests = 10, timeWindow = 60000) {
      this.maxRequests = maxRequests;    // Số request tối đa
      this.timeWindow = timeWindow;      // Khung thời gian (ms)
      this.tokens = maxRequests;         // Số token hiện tại
      this.lastRefill = Date.now();      // Thời điểm nạp lại token cuối cùng
      this.queue = [];                   // Hàng đợi các yêu cầu
    }
    
    refillTokens() {
      const now = Date.now();
      const timePassed = now - this.lastRefill;
      
      if (timePassed >= this.timeWindow) {
        // Nạp lại toàn bộ token nếu đã qua một khung thời gian
        this.tokens = this.maxRequests;
        this.lastRefill = now;
      } else {
        // Nạp lại một phần token dựa trên thời gian đã qua
        const tokensToAdd = Math.floor((timePassed / this.timeWindow) * this.maxRequests);
        if (tokensToAdd > 0) {
          this.tokens = Math.min(this.maxRequests, this.tokens + tokensToAdd);
          this.lastRefill = now;
        }
      }
    }
    
    async acquire() {
      return new Promise((resolve) => {
        // Kiểm tra và nạp lại token
        this.refillTokens();
        
        if (this.tokens > 0) {
          // Có sẵn token, sử dụng ngay lập tức
          this.tokens--;
          resolve();
        } else {
          // Không có token, thêm vào hàng đợi
          this.queue.push(resolve);
          
          // Lên lịch cho lần nạp token tiếp theo
          if (this.queue.length === 1) {
            const waitTime = this.timeWindow - (Date.now() - this.lastRefill);
            setTimeout(() => this.processQueue(), waitTime);
          }
        }
      });
    }
    
    processQueue() {
      // Nạp lại token
      this.refillTokens();
      
      // Xử lý hàng đợi trong khi còn token
      while (this.tokens > 0 && this.queue.length > 0) {
        const resolve = this.queue.shift();
        this.tokens--;
        resolve();
      }
      
      // Lên lịch cho lần tiếp theo nếu còn yêu cầu trong hàng đợi
      if (this.queue.length > 0) {
        const waitTime = this.timeWindow - (Date.now() - this.lastRefill);
        setTimeout(() => this.processQueue(), waitTime);
      }
    }
  }
  
  // Tạo rate limiter cho Google AI API và Crawler
  const aiRateLimiter = new RateLimiter(5, 60000);  // 5 requests/phút
  const crawlerRateLimiter = new RateLimiter(10, 60000);  // 10 requests/phút
  
  module.exports = {
    aiRateLimiter,
    crawlerRateLimiter
  };