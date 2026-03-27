const mysql = require('mysql2/promise');

async function migrate() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'cite_es'
  });

  try {
    console.log('Adding meta_json to comments table...');
    await connection.execute('ALTER TABLE comments ADD COLUMN meta_json LONGTEXT DEFAULT NULL');
    console.log('Migration successful.');
  } catch (err) {
    if (err.code === 'ER_DUP_COLUMN_NAME' || err.message.includes('Duplicate column name')) {
      console.log('Column already exists, skipping.');
    } else {
      console.error('Migration failed:', err);
      process.exit(1);
    }
  } finally {
    await connection.end();
  }
}

migrate();
