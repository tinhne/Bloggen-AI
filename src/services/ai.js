const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { aiRateLimiter } = require('../utils/rateLimiter');

require('dotenv').config();

class AIService {
  constructor() {
    this.apiKey = process.env.GOOGLE_STUDIO_LLM_API_KEY;
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    this.maxRetries = 3;
    this.retryDelay = 2000; // 2 giây
    this.maxContentLength = 10000; // Giới hạn số ký tự
  }

  // Xu li noi dung
  async processContent(content, style = 'professional and informative') {
    try {
      // Đợi token từ rate limiter
      await aiRateLimiter.acquire();
      // Truncate content nếu dài quá
      const truncatedContent = content.length > 10000 
        ? content.substring(0, 10000) + "..." 
        : content;
      
      const prompt = `Viết lại nội dung sau theo phong cách ${style}.  
Cải thiện độ mạch lạc, rõ ràng và hấp dẫn mà không làm thay đổi thông tin.  
Giữ nguyên tiêu đề, sử dụng câu văn tự nhiên, có tổ chức hợp lý. 

Original content:
${truncatedContent}
      `;

      const response = await axios.post(
        `${this.apiUrl}?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && 
          response.data.candidates && 
          response.data.candidates[0] && 
          response.data.candidates[0].content &&
          response.data.candidates[0].content.parts &&
          response.data.candidates[0].content.parts[0]) {
        return response.data.candidates[0].content.parts[0].text;
      } else {
        throw new Error('Unexpected API response structure');
      }
    } catch (error) {
      console.error('Error calling AI API:', error.message);
      if (error.response) {
        console.error('API response:', error.response.data);
      }
      throw new Error(`Error processing content with AI: ${error.message}`);
    }
  }

  // xu li bai viet
  async processArticle(articleId) {
    try {
      // Get the article
      const article = await prisma.article.findUnique({
        where: { id: articleId }
      });
      
      if (!article) {
        throw new Error(`Article with ID ${articleId} not found`);
      }
      
      // Process with AI
      const processedContent = await this.processContent(
        article.originalContent, 
        article.styleRequest || 'professional and informative'
      );
      
      // Update the article
      const updatedArticle = await prisma.article.update({
        where: { id: articleId },
        data: { processedContent }
      });
      
      return updatedArticle;
    } catch (error) {
      throw new Error(`Error processing article ID ${articleId}: ${error.message}`);
    }
  }
}

module.exports = new AIService();