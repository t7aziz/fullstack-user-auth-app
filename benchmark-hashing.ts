// benchmark-hashing.ts
import { performance } from 'perf_hooks';
import bcrypt from 'bcrypt';
import argon2 from 'argon2';

const cryptoAnalyzer = require('./rust-crypto-analyzer');

function generatePasswords(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Password${i}!SecureTest`);
}

async function benchmarkBcrypt(passwords: string[], rounds: number) {
  const start = performance.now();
  for (let i = 0; i < passwords.length; i++) {
    await bcrypt.hash(passwords[i], rounds);
  }
  const end = performance.now();
  return end - start;
}

async function benchmarkNodeArgon2(passwords: string[]) {
  const start = performance.now();
  for (let i = 0; i < passwords.length; i++) {
    await argon2.hash(passwords[i]);
  }
  const end = performance.now();
  return end - start;
}

async function benchmarkRustArgon2Sequential(passwords: string[]) {
  const start = performance.now();
  for (let i = 0; i < passwords.length; i++) {
    await cryptoAnalyzer.hashPassword(passwords[i]);
  }
  const end = performance.now();
  return end - start;
}
  
async function benchmarkRustParallel(passwords: string[]) {
  const start = performance.now();
  await cryptoAnalyzer.batchHashPasswords(passwords);
  const end = performance.now();
  return end - start;
}

async function runBenchmarks() {
  console.log('Password Hashing Performance Benchmark');
  console.log('======================================');
  
  const sizes = [100, 1000];
  
  for (const size of sizes) {
    const passwords = generatePasswords(size);
    
    const bcryptTime = await benchmarkBcrypt(passwords, 10);
    const nodeArgon2Time = await benchmarkNodeArgon2(passwords);
    const rustSequentialTime = await benchmarkRustArgon2Sequential(passwords);
    const rustParallelTime = await benchmarkRustParallel(passwords);
    
    const sequentialSpeedup = rustSequentialTime / rustParallelTime;
    const nodeSpeedup = nodeArgon2Time / rustParallelTime;
    
    console.log(`${size} passwords:`);
    console.log('-'.repeat(80));
    console.log(`Node bcrypt (10 rounds):       ${(bcryptTime / 1000).toFixed(2)}s`);
    console.log(`Node Argon2:                   ${(nodeArgon2Time / 1000).toFixed(2)}s`);
    console.log(`Rust Argon2 (sequential):      ${(rustSequentialTime / 1000).toFixed(2)}s`);
    console.log(`Rust Argon2 (parallel):        ${(rustParallelTime / 1000).toFixed(2)}s`);
    console.log(`Rust parallel speedup: ${sequentialSpeedup.toFixed(2)}x faster than sequential, ${nodeSpeedup.toFixed(2)}x faster than Node`);
  }
  
  console.log('Key Insights');
  console.log('='.repeat(80));
  
  // Calculate average speedup
  const passwords100 = generatePasswords(100);
  const node100 = await benchmarkNodeArgon2(passwords100);
  const rustParallel100 = await benchmarkRustParallel(passwords100);
  const avgSpeedup = node100 / rustParallel100;
  
  console.log(`1. Rust parallel processing shows ~${avgSpeedup.toFixed(1)}x speedup for batch operations`);
}

runBenchmarks().catch(console.error);