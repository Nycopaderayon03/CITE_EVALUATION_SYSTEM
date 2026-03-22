import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export async function GET() {
  try {
    // Ensure table exists dynamically just in case it wasn't migrated
    await query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        setting_key VARCHAR(100) PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const result = await query('SELECT setting_key, setting_value FROM system_settings');
    const settingsMap: Record<string, any> = {};
    
    // Parse boolean/arrays accurately from string format
    if (Array.isArray(result)) {
      result.forEach((row: any) => {
        try {
          settingsMap[row.setting_key] = JSON.parse(row.setting_value);
        } catch {
          settingsMap[row.setting_key] = row.setting_value;
        }
      });
    }

    return NextResponse.json({ success: true, data: settingsMap });
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return NextResponse.json({ error: 'Failed to retrieve settings' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Ensure table exists
    await query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        setting_key VARCHAR(100) PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Loop through object and upsert
    const keys = Object.keys(body);
    for (const key of keys) {
      let value = body[key];
      // Convert booleans or objects to string JSON for safe text storage
      if (typeof value === 'boolean' || typeof value === 'object') {
        value = JSON.stringify(value);
      }
      
      await query(
        `INSERT INTO system_settings (setting_key, setting_value) 
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = ?`,
        [key, String(value), String(value)]
      );
    }

    return NextResponse.json({ success: true, message: 'Settings saved.' });
  } catch (error) {
    console.error('Failed to save settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
