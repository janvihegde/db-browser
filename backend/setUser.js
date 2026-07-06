const bcrypt = require('bcrypt');
const pool = require('./src/config/db'); // Adjust path if your db.js is located elsewhere

async function fixAdminPassword() {
    try {
        // 1. Generate a real, mathematically valid hash for 'admin123'
        const realHash = await bcrypt.hash('admin123', 10);
        
        // 2. Update the database
        await pool.query(
            "UPDATE app_users SET password_hash = $1 WHERE email = 'admin@example.com'",
            [realHash]
        );
        
        console.log("✅ Success! The admin password has been updated to 'admin123'.");
    } catch (err) {
        console.error("❌ Error:", err.message);
    } finally {
        process.exit();
    }
}

fixAdminPassword();