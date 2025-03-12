const express = require('express');
const router = express.Router();
const databaseService = require('../../services/database');

// Get all categories
router.get('/', async (req, res) => {
  try {
    const categories = await databaseService.getAllCategories();
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get category by ID
router.get('/:id', async (req, res) => {
  try {
    const category = await databaseService.getCategoryById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }
    res.json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new category
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Category name is required' });
    }
    
    const category = await databaseService.createCategory(name);
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;