const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class DatabaseService {
// get all categories
  async getAllCategories() {
    return await prisma.category.findMany({
      include: {
        _count: {
          select: { articles: true }
        }
      }
    });
  }
  
  // laays theo ID
  async getCategoryById(id) {
    return await prisma.category.findUnique({
      where: { id: Number(id) },
      include: {
        articles: true
      }
    });
  }
  
  // tao moi category
  async createCategory(name) {
    return await prisma.category.create({
      data: { name }
    });
  }
  
  //  get all articles
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
  
  // get article by ID
  async getArticleById(id) {
    return await prisma.article.findUnique({
      where: { id: Number(id) },
      include: {
        category: true
      }
    });
  }
  
  // search articles
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