const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class DatabaseService {
  /**
   * Get all categories
   * @returns {Promise<Array>} - List of all categories
   */
  async getAllCategories() {
    return await prisma.category.findMany({
      include: {
        _count: {
          select: { articles: true }
        }
      }
    });
  }
  
  /**
   * Get a category by ID
   * @param {number} id - The category ID
   * @returns {Promise<object>} - The category
   */
  async getCategoryById(id) {
    return await prisma.category.findUnique({
      where: { id: Number(id) },
      include: {
        articles: true
      }
    });
  }
  
  /**
   * Create a new category
   * @param {string} name - The category name
   * @returns {Promise<object>} - The created category
   */
  async createCategory(name) {
    return await prisma.category.create({
      data: { name }
    });
  }
  
  /**
   * Get all articles with pagination
   * @param {number} page - Page number
   * @param {number} pageSize - Number of items per page
   * @returns {Promise<object>} - Paginated articles
   */
  async getArticles(page = 1, pageSize = 10) {
    const skip = (page - 1) * pageSize;
    
    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        skip,
        take: pageSize,
        include: {
          category: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.article.count()
    ]);
    
    return {
      data: articles,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }
  
  /**
   * Get article by ID
   * @param {number} id - The article ID
   * @returns {Promise<object>} - The article
   */
  async getArticleById(id) {
    return await prisma.article.findUnique({
      where: { id: Number(id) },
      include: {
        category: true
      }
    });
  }
  
  /**
   * Search articles
   * @param {string} query - Search query
   * @param {number} categoryId - Category ID filter
   * @param {number} page - Page number
   * @param {number} pageSize - Number of items per page
   * @returns {Promise<object>} - Search results
   */
  async searchArticles(query = '', categoryId = null, page = 1, pageSize = 10) {
    const skip = (page - 1) * pageSize;
    
    const where = {};
    
    // Add search conditions if query is provided
    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { processedContent: { contains: query, mode: 'insensitive' } }
      ];
    }
    
    // Add category filter if provided
    if (categoryId) {
      where.categoryId = Number(categoryId);
    }
    
    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          category: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.article.count({ where })
    ]);
    
    return {
      data: articles,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }
}

module.exports = new DatabaseService();