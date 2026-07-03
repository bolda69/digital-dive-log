const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function run() {
  for (const dbPath of ['./dives.db', '/home/daniel/mnt/powerdesign/api.logbuch.powerdesign.ch/dives.db']) {
    try {
      console.log('Migrating', dbPath);
      const db = await open({ filename: dbPath, driver: sqlite3.Database });
      await db.exec('ALTER TABLE dives ADD COLUMN bemerkungen TEXT;');
      await db.close();
      console.log('Success for', dbPath);
    } catch(e) {
      if (e.message.includes('duplicate column name')) {
        console.log('Column already exists in', dbPath);
      } else {
        console.error('Error for', dbPath, e);
      }
    }
  }
}
run();
