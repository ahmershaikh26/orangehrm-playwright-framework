#!/usr/bin/env ts-node
import { AITriage } from '../src/utils/ai-triage.util';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
  try {
    const reportPath = process.argv[2] || undefined;
    const summary = await AITriage.summarizeFailures(reportPath);
    console.log('\n=== AI Triage Summary ===\n');
    console.log(summary);
    console.log('\n=== End ===\n');
  } catch (err: any) {
    console.error('Triage failed:', err.message || err);
    process.exit(2);
  }
})();