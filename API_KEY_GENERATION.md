# API Key Generation Guide

## Overview
This guide shows different methods to generate a secure API key for the Auto-Assignment API using command line tools.

## Method 1: OpenSSL (Recommended)

### Generate a 32-byte (256-bit) random key
```bash
openssl rand -hex 32
```
**Example output:** `a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456`

### Generate a base64 encoded key
```bash
openssl rand -base64 32
```
**Example output:** `mZ2kL8vQ3nP5tR7uY9wE2sA4bD6gH1jK3lM8pO0xV5z`

## Method 2: Node.js (if you have Node.js installed)

### Generate using Node.js crypto module
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
**Example output:** `f7e8d9c0b1a2938475869012345678901234567890abcdef1234567890abcdef`

### Generate base64 version
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
**Example output:** `9+jZwLGik4R1hpASNFZ4kBI0VniQGrPe8SNFZpASNFY=`

## Method 3: Python (if you have Python installed)

### Generate using Python
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```
**Example output:** `d8e9f0a1b2c3456789012345678901234567890abcdef1234567890abcdef1234`

### Generate using Python (urlsafe)
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```
**Example output:** `mZ2kL8vQ3nP5tR7uY9wE2sA4bD6gH1jK3lM8pO0xV5z`

## Method 4: Using /dev/urandom (Linux/macOS)

### Generate hexadecimal key
```bash
head -c 32 /dev/urandom | xxd -p -c 32
```
**Example output:** `a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456`

### Generate base64 key
```bash
head -c 32 /dev/urandom | base64
```
**Example output:** `mZ2kL8vQ3nP5tR7uY9wE2sA4bD6gH1jK3lM8pO0xV5z=`

## Method 5: UUID (simpler but less secure)

### Generate UUID v4
```bash
uuidgen
```
**Example output:** `123e4567-e89b-12d3-a456-426614174000`

### Remove dashes for cleaner key
```bash
uuidgen | tr -d '-'
```
**Example output:** `123e4567e89b12d3a456426614174000`

## Setting the Environment Variable

### For Development (.env.local)
1. Create or edit `.env.local` file in your project root:
```bash
echo "AUTO_ASSIGNMENT_API_KEY=your_generated_key_here" >> .env.local
```

### For Production (Vercel)
```bash
vercel env add AUTO_ASSIGNMENT_API_KEY
# Enter your generated key when prompted
```

### For Production (Other platforms)
```bash
# Railway
railway variables set AUTO_ASSIGNMENT_API_KEY=your_generated_key_here

# Heroku
heroku config:set AUTO_ASSIGNMENT_API_KEY=your_generated_key_here

# AWS/Docker
export AUTO_ASSIGNMENT_API_KEY=your_generated_key_here
```

## Complete Setup Example

### 1. Generate the key
```bash
# Using OpenSSL (recommended)
API_KEY=$(openssl rand -hex 32)
echo "Generated API key: $API_KEY"
```

### 2. Add to your environment
```bash
# For local development
echo "AUTO_ASSIGNMENT_API_KEY=$API_KEY" >> .env.local

# Verify it was added
grep AUTO_ASSIGNMENT_API_KEY .env.local
```

### 3. Test the API
```bash
# Test the status endpoint
curl "http://localhost:3000/api/auto-assignment/status?api_key=$API_KEY"
```

## Security Best Practices

1. **Key Length**: Use at least 32 characters (256 bits) for strong security
2. **Character Set**: Use hexadecimal or base64 for compatibility
3. **Storage**: Never commit API keys to version control
4. **Rotation**: Rotate keys regularly (monthly/quarterly)
5. **Access**: Limit access to the key to necessary personnel only
6. **Monitoring**: Log API key usage for security monitoring

## Key Storage Checklist

- [ ] Generated using cryptographically secure random source
- [ ] At least 32 characters long
- [ ] Stored in environment variables, not in code
- [ ] Added to `.env.local` for development
- [ ] Added to production environment variables
- [ ] Added `.env.local` to `.gitignore` (if not already)
- [ ] Documented for team members who need access
- [ ] Set up key rotation schedule

## Common Issues

### Issue: "Invalid API key" error
**Solution:** 
- Check the environment variable name: `AUTO_ASSIGNMENT_API_KEY`
- Verify the key matches exactly (no extra spaces/characters)
- Restart your development server after adding the env variable

### Issue: Environment variable not found
**Solution:**
- Make sure `.env.local` is in the project root directory
- Restart your Next.js development server
- Check that the file is not named `.env.local.txt` or similar

### Issue: Key not working in production
**Solution:**
- Set the environment variable in your hosting platform
- Redeploy your application after setting the variable
- Check the platform's environment variable settings interface 