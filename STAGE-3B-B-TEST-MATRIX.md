# Stage 3B-B Test Matrix

## Agency pricing

- 0% agency discount
- Stack policy
- Best-of policy where campaign discount wins
- Best-of policy where agency discount wins
- Agency-replaces-campaign policy
- Multiple cart combinations
- Holiday deductions preserved
- Date premium preserved
- Exact multi-month campaign discount preserved or replaced according to policy

## Credit

- Net total below available credit
- Net total equal to available credit
- Net total above available credit
- Active hold reduces portal availability
- Pending exception does not reduce current available credit
- Approved exception becomes exposure
- Declined exception releases the pending hold
- Positive ledger adjustment increases exposure
- Negative ledger adjustment reduces exposure

## Security

- Agency buyer can view only own agency credit records
- Agency buyer cannot open /admin/credit
- Finance can open /admin/credit
- System administrator can open /admin/credit
- AAL1 session is redirected to MFA
- Server recalculates agency pricing and does not trust browser totals
