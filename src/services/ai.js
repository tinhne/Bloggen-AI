const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
require('dotenv').config();

class AIService {
  constructor() {
    this.apiKey = process.env.GOOGLE_STUDIO_LLM_API_KEY;
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
  }

  /**
   * Process content with Google Studio LLM
   * @param {string} content - The original content
   * @param {string} style - The requested style
   * @returns {Promise<string>} - The processed content
   */
  async processContent(content, style = 'professional and informative') {
    try {
      // Truncate content if it's too long (API limits)
      const truncatedContent = content.length > 10000 
        ? content.substring(0, 10000) + "..." 
        : content;
      
      const prompt = `Hãy viết lại bài viết sau đây theo phong cách ${style}. 
Giữ nguyên thông tin và sự thật nhưng cải thiện định dạng, độ dễ đọc và sự hấp dẫn.
Sử dụng các tiêu đề, đoạn văn và cấu trúc phù hợp. 

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

  /**
   * Process an article with AI and update in database
   * @param {number} articleId - The article ID to process
   * @returns {Promise<object>} - The updated article
   */
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