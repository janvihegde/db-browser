import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api', // Pointing to your Node.js backend
});

export default api;