# Homepage PLACE ORDER connection

The homepage should use:

```tsx
const orderPath = "/order";
```

Every PLACE ORDER button should use:

```tsx
href={orderPath}
```

Keep the direct contact email link unchanged:

```tsx
href="mailto:ventas@lagrandiosapr.com"
```

The customer flow is:

```text
PLACE ORDER → /order → Add to contract → /cart
```
