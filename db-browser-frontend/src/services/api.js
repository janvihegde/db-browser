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
    // https://your-backend.onrender.com/api. Falls back to a working
    // default so local dev / a fresh clone still work without a .env file.
    baseURL: import.meta.env.VITE_API_URL || 'https://db-browser-2.onrender.com/api' ,
});

api.interceptors.request.use((config) => {
    config.headers['X-Device-Id'] = getDeviceId();
    return config;
});

export default api;