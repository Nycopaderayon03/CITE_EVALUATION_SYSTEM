const { query } = require('../lib/db');

async function migrate() {
  try {
    console.log('Adding meta_json to comments table...');
    await query('ALTER TABLE comments ADD COLUMN meta_json LONGTEXT DEFAULT NULL');
    console.log('Migration successful.');
    process.exit(0);
  } catch (err) {
    if (err.code === 'ER_DUP_COLUMN_NAME' || err.message.includes('Duplicate column name')) {
      console.log('Column already exists, skipping.');
      process.exit(0);
    }
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
