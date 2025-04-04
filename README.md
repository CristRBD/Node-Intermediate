# Intermediate: Price Monitoring with BigNumber Precision and Rate Limiting

This project monitors token prices with precise arithmetic using BigNumber, hashes prices with Keccak, and applies rate limiting. **Intentional bugs are included, requiring execution and debugging to submit correct answers.**

## Source Code
- **File**: `intermediate.js`

## Prerequisites
- **Node.js**: v16+
- **Dependencies**: `npm install express bignumber.js keccak rate-limiter-flexible axios nodelogex node-cron redis socket.io moment lodash ethers`
- **Environment**: Infura ID, Redis on `localhost:6379`

## Setup
1. `npm install`
2. Set `.env`:
```
	INFURA_PROJECT_ID=your-id
```
3. `redis-server`
4. `node intermediate.js`

## Problems and Questions
**All answers require running and debugging the code due to intentional bugs.**

1. **Execution Analysis**  
- Run `/price/ethereum`, `/price/hash`, `/price/alert`, and `/yield/analytics`. Why does the `yieldRates` in `/yield/analytics` produce inconsistent or incorrect values? Analyze the responses and logs to determine the cause.

2. **Bug Identification**  
- Identify and fix the bug in `fetchPrice` where the `price` stored in Redis isn’t properly converted from BigNumber to string, causing type mismatches. Submit the corrected code and explain your solution.

3. **Debugging Process**  
- After setting an alert with `/price/alert` and running the cron job, verify if the alert triggers correctly. If it doesn’t (e.g., no log entry for `alert_triggered`), describe your step-by-step debugging process to identify the issue (e.g., checking `threshold` type).

4. **Complexity Enhancement**  
- Propose adding a feature to store and retrieve historical price hashes for auditability using `keccak`. Provide sample code for this enhancement.
