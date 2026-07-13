import axios from 'axios';

const api = axios.create({
    // Set VITE_API_URL in Vercel's project env vars, e.g.
    // https://your-backend.onrender.com/api. Falls back to localhost so
    // local dev keeps working without a .env file.
    baseURL: import.meta.env.VITE_API_URL || 'https://db-browser-2.onrender.com',
    withCredentials: true // CRITICAL: This allows httpOnly cookies to be sent
});

export default api;
