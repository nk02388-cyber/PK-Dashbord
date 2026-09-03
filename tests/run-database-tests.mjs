import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import runTest from './database.integration.cjs';
if (!process.env.QA_PG_RUNTIME) throw new Error('Set QA_PG_RUNTIME to the temporary directory containing embedded-postgres and pg');
const require=createRequire(path.resolve(process.env.QA_PG_RUNTIME,'package.json'));
const {default:EmbeddedPostgres}=await import(pathToFileURL(require.resolve('embedded-postgres')));
const pg=require('pg'); pg.types.setTypeParser(1184,value=>value);
const password=randomBytes(24).toString('hex'),database='codex_test_dashboard';
const server=new EmbeddedPostgres({databaseDir:path.resolve('work/database-test-'+Date.now()),
  user:'postgres',password,port:55439,persistent:true,authMethod:'scram-sha-256',
  initdbFlags:['--encoding=UTF8','--locale=C'],postgresFlags:['-c','listen_addresses=127.0.0.1','-c','wal_level=logical'],
  onLog:()=>{},onError:message=>{if(String(message).includes('FATAL'))console.error(String(message));}});
try {
  await server.initialise();await server.start();await server.createDatabase(database);
  const report=await runTest({Client:pg.Client,connection:{host:'127.0.0.1',port:55439,database,user:'postgres',password}});
  await fs.mkdir('work',{recursive:true});
  await fs.writeFile('work/database-integration-result.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally {await server.stop();}
