const { exec } = require('child_process');
const date = new Date().toISOString().replace(/:/g, '-');

exec(`mongodump --uri=${process.env.MONGODB_URI} --out=./backups/${date}`, 
  (error, stdout, stderr) => {
    if (error) {
      console.error('Backup failed:', error);
      return;
    }
    console.log('Backup successful:', stdout);
});