const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./leaderboard.db');

db.run('DELETE FROM scores', function(err) {
    if (err) {
        console.error('Error clearing leaderboard:', err);
        process.exit(1);
    }
    
    console.log(`Cleared ${this.changes} scores from leaderboard`);
    
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});