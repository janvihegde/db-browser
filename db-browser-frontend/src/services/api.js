import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:5000/api', // Adjust to your backend URL
    withCredentials: true // CRITICAL: This allows httpOnly cookies to be sent
});

export default api;