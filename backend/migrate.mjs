import { join } from 'node:path';
import { createDatabase } from './database.mjs';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL é obrigatória para executar migrações de produção.');
}

const database = await createDatabase({ sqlitePath: join(import.meta.dirname, 'data', 'projeto-aprendiz.db') });
console.log('Migrações aplicadas com sucesso.');
await database.close();
