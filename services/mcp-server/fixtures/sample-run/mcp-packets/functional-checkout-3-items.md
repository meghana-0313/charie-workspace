# Fix instruction — functional-checkout-3-items [blocker/functional]

## Problem
Place order silently fails with 3+ items in cart

## Reproduce
1. Add 3 different travel passes to the cart
2. Open checkout, enter a valid email and name, click Continue
3. Enter card details and click Place order (twice)
4. Observe: no confirmation, no error message; 500 POST /api/checkout

## Suspected cause (confidence: high, source: heuristic)
Checkout API returns 500 for 3+ items and the client swallows the failure.

## Required fix
Server: make POST /api/checkout handle multi-item carts. Client: show an error toast on non-OK responses.

## Accept when (verifier will check this)
Re-run this journey: order must reach /success and no 500 on /api/checkout.

## Context
- Goal: Buy 3 different travel passes and complete checkout without assistance
- Target: http://localhost:3101 (build: buggy)
- Evidence: step-05-order-failed.png + trace.json
