const axios = require('axios');
require('dotenv').config();

async function listModels() {
  try {
    const response = await axios.get('https://api.example.com/v1beta/models', {
      headers: {
        'Authorization': `Bearer ${process.env.GOOGLE_AI_API_KEY}`
      }
    });
    console.log('Available models:', response.data);
  } catch (error) {
    console.error('Error listing models:', error.message);
    if (error.response && error.response.data) {
      console.error('API response:', error.response.data);
    }
  }
}

listModels();