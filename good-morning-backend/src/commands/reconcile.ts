import { pool } from '../db/pool';
import { reconcile } from '../services/reconciliation';
reconcile(process.argv[2]).then(result => { console.log(JSON.stringify(result)); }).catch(error => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
