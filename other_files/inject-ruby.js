const mysql = require('mysql2/promise');

async function injectAccounts() {
  try {
    const ddb = await mysql.createConnection({
      host: 'localhost',
      port: 3307,
      user: 'root',
      password: 'cite_es_password',
      database: 'cite_es'
    });

    console.log('Connected to Docker DB on port 3307');

    await ddb.query(`
      INSERT IGNORE INTO users (id, name, email, password, role, course, year_level, section, is_active) 
      VALUES 
      ('b5968873-b976-4d55-bf7e-5614856f6d01', 'Ruby Grace Ones', 'rubygrace.ones@jmc.edu.ph', 'babykhaki', 'student', 'BSIT', 3, 'A', 1),
      ('d6ca5c9e-e82d-4409-94e3-157060787db1', 'Ceilo Morales', 'ceilo.morales@jmc.edu.ph', 'ceilomorales', 'student', 'BSIT', 3, 'A', 1),
      ('7b50fc93-75c3-4f7f-8dd7-650f2cad40ea', 'Jerwin Carreon', 'jerwin.carreon@jmc.edu.ph', 'jerwin1234', 'teacher', NULL, NULL, NULL, 1),
      ('97709a40-ded8-406c-b143-3388a51ce694', 'Efhrain Pajota', 'efhrain.pajota@jmc.edu.ph', '12345678', 'teacher', NULL, NULL, NULL, 1)
    `);

    console.log('Accounts from your screenshot injected into Docker successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Failed', err);
    process.exit(1);
  }
}

injectAccounts();
