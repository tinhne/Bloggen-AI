const express = require('express');
const router = express.Router();
const databaseService = require('../../services/database');
const crawlerService = require('../../services/crawler');
const aiService = require('../../services/ai');

// Get all articles with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    
    const articles = await databaseService.getArticles(page, pageSize);
    res.json({ success: true, ...articles });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get article by ID
router.get('/:id', async (req, res) => {
  try {
    const article = await databaseService.getArticleById(req.params.id);
    if (!article) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }
    res.json({ success: true, data: article });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search articles
router.get('/search', async (req, res) => {
  try {
    const { query, categoryId, page, pageSize } = req.query;
    const result = await databaseService.searchArticles(
      query,
      categoryId ? parseInt(categoryId) : null,
      parseInt(page) || 1,
      parseInt(pageSize) || 10
    );
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new article by crawling URL
router.post('/crawl', async (req, res) => {
  try {
    const { url, style, categoryName } = req.body;
    
    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }
    
    if (!categoryName) {
      return res.status(400).json({ success: false, error: 'Category name is required' });
    }
    
    // Crawl and save the article
    const article = await crawlerService.crawlAndSave(
      url, 
      style || 'professional and informative', 
      categoryName
    );


    // Process with AI
    const processedArticle = await aiService.processArticle(article.id);
    
    res.status(201).json({ success: true, data: processedArticle });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Process or re-process article with AI
router.post('/:id/process', async (req, res) => {
  try {
    const articleId = parseInt(req.params.id);
    const article = await databaseService.getArticleById(articleId);
    
    if (!article) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }
    
    // Process with AI
    const processedArticle = await aiService.processArticle(articleId);
    
    res.json({ success: true, data: processedArticle });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;