require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');
const fs = require('fs');

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cite_es'
  });

  await connection.query(`
    CREATE TABLE IF NOT EXISTS subjects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      program VARCHAR(20) NOT NULL,
      year_level VARCHAR(20) NOT NULL,
      semester VARCHAR(20) NOT NULL,
      is_archived TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_subject_prog (code, program)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log('table subjects created.');

  const fileContent = fs.readFileSync('./data/curriculum.ts', 'utf8');
  let dataMatch = fileContent.match(/export const curriculum = (\{[\s\S]*?\});/);
  
  if (dataMatch) {
    let currContent;
    eval('currContent = ' + dataMatch[1]);
    
    for (const prog of Object.keys(currContent)) {
      for (const yr of Object.keys(currContent[prog])) {
        for (const sem of Object.keys(currContent[prog][yr])) {
          for (const subj of currContent[prog][yr][sem]) {
            await connection.query('INSERT IGNORE INTO subjects (code, name, program, year_level, semester) VALUES (?, ?, ?, ?, ?)', [subj.code, subj.name, prog, yr, sem]);
          }
        }
      }
    }
    console.log('subjects inserted successfully');
  } else {
    console.log('no curriculum object found');
  }

  await connection.end();
}

migrate().catch(console.error);
