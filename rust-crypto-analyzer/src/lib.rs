use napi::bindgen_prelude::*;
use napi_derive::napi;
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use argon2::password_hash::{rand_core::OsRng, SaltString};
use sha1::{Digest, Sha1}; // for HIBP
use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use rayon::prelude::*; // parallel iterator
use regex::Regex;
use std::time::Instant;
use once_cell::sync::Lazy; // for regex precompiling

// Structs for API Response
#[napi(object)]
#[derive(Serialize, Deserialize)]
pub struct PasswordAnalysis {
    pub is_compliant: bool,
    pub strength_score: u32,
    pub entropy_bits: f64,
    pub pattern_analysis: PatternAnalysis,
    pub feedback: Vec<String>,
    pub analysis_time_ms: i64,
}

#[napi(object)]
#[derive(Serialize, Deserialize, Clone)] // Cloned for re-use
pub struct PatternAnalysis {
    pub has_uppercase: bool,
    pub has_lowercase: bool,
    pub has_numbers: bool,
    pub has_symbols: bool,
    pub length: u32,
    pub repeated_chars: u32,
    pub sequential_chars: u32,
}

const COMMON_PASSWORDS: &[&str] = &["password", "123456", "qwerty", "admin"];

// Regex patterns are compiled once at startup
static COMMON_PATTERNS_RE: Lazy<Vec<Regex>> = Lazy::new(|| {
    vec![
        Regex::new(r"\d{4}").unwrap(), // 4 consecutive digits
        Regex::new(r"(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl)").unwrap(),
        Regex::new(r"(123|234|345|456|567|678|789)").unwrap(),
        Regex::new(r"(qwe|wer|ert|rty|tyu|yui|uio|iop)").unwrap(),
    ]
});

#[napi]
// Analyzes a password against policies without hashing it
pub fn check_password_policy(password: String) -> Result<PasswordAnalysis> {
    let start_time = Instant::now();
    
    let pattern_analysis = analyze_patterns(&password);
    let strength_score = calculate_strength_score(&password, &pattern_analysis);
    let entropy_bits = calculate_entropy(&password, &pattern_analysis);
    
    let feedback = generate_feedback(&password, &pattern_analysis, strength_score);
    
    let is_compliant = password.len() >= 8 
        && strength_score > 50 
        && !is_common_password(&password)
        && pattern_analysis.sequential_chars == 0;
    
    let analysis_time_ms = start_time.elapsed().as_millis() as i64;
    
    Ok(PasswordAnalysis {
        is_compliant,
        strength_score,
        entropy_bits,
        pattern_analysis,
        feedback, 
        analysis_time_ms,
    })
}


#[napi]
/// Hashes a password securely using Argon2
pub fn hash_password(password: String) -> Result<String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    
    match argon2.hash_password(password.as_bytes(), &salt) {
        Ok(hash) => Ok(hash.to_string()),
        Err(_) => Err(Error::from_reason("Failed to hash password")),
    }
}

#[napi]
// Verifies a plaintext password against a stored Argon2 hash
pub fn verify_password_hash(password: String, hash: String) -> Result<bool> {
    match PasswordHash::new(&hash) {
        Ok(parsed_hash) => {
            let argon2 = Argon2::default();
            Ok(argon2.verify_password(password.as_bytes(), &parsed_hash).is_ok())
        }
        Err(_) => Ok(false), // If hash fails, it can't be valid
    }
}

#[napi]
// Hashes a large number of passwords in parallel
pub fn batch_hash_passwords(passwords: Vec<String>) -> Result<HashMap<String, String>> {
    let results: HashMap<String, String> = passwords
        .par_iter()
        .map(|password| {
            let hash = hash_password(password.clone()).unwrap_or_else(|_| "ERROR".to_string());
            (password.clone(), hash)
        })
        .collect();
    
    Ok(results)
}

#[napi]
// hash password with sha1 for Have I Been Pwned
pub fn hash_password_sha1(password: String) -> Result<String> {
    let mut hasher = Sha1::new();
    hasher.update(password.as_bytes());
    let result = hasher.finalize();
    Ok(hex::encode(result).to_uppercase())
}

fn analyze_patterns(password: &str) -> PatternAnalysis {
    PatternAnalysis {
        has_uppercase: password.chars().any(|c| c.is_uppercase()),
        has_lowercase: password.chars().any(|c| c.is_lowercase()),
        has_numbers: password.chars().any(|c| c.is_numeric()),
        has_symbols: password.chars().any(|c| !c.is_alphanumeric()),
        length: password.len() as u32,
        repeated_chars: count_repeated_chars(password),
        sequential_chars: count_sequential_chars(password),
    }
}

fn calculate_strength_score(password: &str, analysis: &PatternAnalysis) -> u32 {
    let mut score = 0u32;
    
    // Length scoring (I made up the numbers)
    score += match password.len() {
        0..=7 => 5,
        8..=11 => 25,
        _ => 40,
    };
    
    if analysis.has_lowercase { score += 10; }
    if analysis.has_uppercase { score += 10; }
    if analysis.has_numbers { score += 15; }
    if analysis.has_symbols { score += 20; }
    
    if analysis.repeated_chars > 0 { score = score.saturating_sub(10); }
    if analysis.sequential_chars > 0 { score = score.saturating_sub(15); }
    
    std::cmp::min(score, 100)
}

fn calculate_entropy(password: &str, analysis: &PatternAnalysis) -> f64 {
    let mut charset_size = 0;
    if analysis.has_lowercase { charset_size += 26; }
    if analysis.has_uppercase { charset_size += 26; }
    if analysis.has_numbers { charset_size += 10; }
    if analysis.has_symbols { charset_size += 32; }
    
    let length = password.len() as f64;
    length * (charset_size as f64).log2()
}

fn generate_feedback(password: &str, analysis: &PatternAnalysis, score: u32) -> Vec<String> {
    let mut feedback = Vec::new();
    
    if password.len() < 8 {
        feedback.push("Password is too short (minimum 8 characters recommended).".to_string());
    }
    if is_common_password(password) {
        feedback.push("This password is too common and easy to guess.".to_string());
    }
    if analysis.sequential_chars > 0 {
        feedback.push("Passwords must not contain sequential characters (e.g., 'abc', '123').".to_string());
    }
    if !analysis.has_uppercase {
        feedback.push("Consider adding uppercase letters for more strength.".to_string());
    }
    if !analysis.has_numbers {
        feedback.push("Adding numbers will make your password stronger.".to_string());
    }
    if !analysis.has_symbols {
        feedback.push("Special characters like !@#$%^&* add significant security.".to_string());
    }
    if score < 75 {
        feedback.push("For maximum security, use a password manager to generate long, random passwords.".to_string());
    }
    
    feedback
}

// Helpers

fn is_common_password(password: &str) -> bool {
    let lower_password = password.to_lowercase();
    COMMON_PASSWORDS.contains(&lower_password.as_str())
}

fn count_repeated_chars(password: &str) -> u32 {
    let chars: Vec<char> = password.chars().collect();
    let mut count = 0;
    for window in chars.windows(3) {
        if window[0] == window[1] && window[1] == window[2] {
            count += 1;
        }
    }
    count
}

fn count_sequential_chars(password: &str) -> u32 {
    let lower_password = password.to_lowercase();
    COMMON_PATTERNS_RE.iter().filter(|re| re.is_match(&lower_password)).count() as u32
}