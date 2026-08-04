# Stage 3A Test Matrix

| Test | Expected result |
|---|---|
| Empty cart opens client page | User is redirected by guidance to build a campaign |
| Missing full name | Browser blocks submission |
| Invalid email | Browser/server rejects submission |
| Missing telephone | Browser/server rejects submission |
| Missing address | Browser/server rejects submission |
| Valid form + valid cart | Order record and order number created |
| Cart total altered in browser | Server ignores altered totals and recalculates |
| Unknown SKU | Server rejects request |
| Invalid dates | Server rejects request |
| SMS checkbox off | Email notifications only are queued |
| SMS checkbox on | Customer SMS notification is also queued |
| Missing Supabase env | API returns configuration error without exposing secrets |
| Migration not installed | API returns order-save failure |
| Successful submission | Local cart clears and confirmation page appears |
| Internal notification row | Recipient is processing@lagrandiosapr.com |
| Customer email notification row | Sender is orders@lagrandiosapr.com and reply-to is ventas@lagrandiosapr.com |
