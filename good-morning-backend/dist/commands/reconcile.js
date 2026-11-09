"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("../db/pool");
const reconciliation_1 = require("../services/reconciliation");
(0, reconciliation_1.reconcile)(process.argv[2]).then(result => { console.log(JSON.stringify(result)); }).catch(error => { console.error(error); process.exitCode = 1; }).finally(() => pool_1.pool.end());
//# sourceMappingURL=reconcile.js.map