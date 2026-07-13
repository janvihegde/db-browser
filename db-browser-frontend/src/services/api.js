import axios from 'axios';

// Identity is just a random ID generated once per browser and stored in
// localStorage — no signup, no password. Clearing storage or switching
// browsers/devices means a "new" user with no saved connections.
const DEVICE_ID_KEY = 'db_browser_device_id';

function getDeviceId() {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
}

const api = axios.create({
    // Set VITE_API_URL in Vercel's project env vars, e.g.
    // https://your-backend.onrender.com/api. Falls back to localhost so
    // local dev keeps working without a .env file.
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
    withCredentials: true // CRITICAL: This allows httpOnly cookies to be sent
});

export default api;
