# Portfolio Share - PocketBase Collection Schema

## Collection: `portfolio_shares`

This collection enables secure sharing of portfolio items with external viewers (evaluators, grandparents, co-ops) via unique tokenized links.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user` | Relation → users | ✓ | Owner of the share link |
| `child` | Relation → children | | Optional - if null, shares all children's work |
| `token` | Text (unique, 24 chars) | ✓ | Secure random token for the share URL |
| `label` | Text | | Human-readable label (e.g. "For Grandma", "Evaluator 2026") |
| `expires_at` | DateTime | | Optional expiration date |
| `include_grades` | Bool | | Future: include grade data |
| `include_attendance` | Bool | | Future: include attendance data |
| `view_count` | Number (default: 0) | | Tracks how many times the link has been viewed |
| `last_viewed` | DateTime | | Last time someone viewed this share |
| `active` | Bool (default: true) | ✓ | Can be toggled to pause/unpause a share |

### API Rules

```javascript
// List Rule - Only owner can see their shares
@request.auth.id = user.id

// View Rule - Same as list
@request.auth.id = user.id

// Create Rule - Must be authenticated user
@request.auth.id != "" && @request.auth.id = @request.data.user

// Update Rule - Only owner
@request.auth.id = user.id

// Delete Rule - Only owner
@request.auth.id = user.id
```

### Public Access Rule (Important!)

For the public share page to work, you need to add a **separate list rule** that allows unauthenticated access by token:

```javascript
// Additional List Rule (OR with the owner rule):
token = @request.query.token || @request.auth.id = user.id
```

Or, create a **custom API endpoint** or use client-side filtering with a more permissive rule during development.

**Recommended approach for production:**
1. Keep the collection locked down
2. Create a PocketBase hook or custom endpoint that validates tokens
3. Return portfolio data only for valid, active, non-expired tokens

### Quick Setup (Development)

For quick development testing, you can use this permissive list rule:

```javascript
// WARNING: Only for development!
active = true
```

This allows the public page to fetch share records. In production, add proper token validation.

### Usage

1. User creates a share from the Portfolio page
2. System generates a unique 24-character token
3. Share URL format: `https://your-domain.com/share/{token}`
4. Recipients can view the portfolio without logging in
5. Owner can pause, reactivate, or delete shares anytime
6. Expired shares show an error message to viewers

### Example Token Generation

```javascript
const generateToken = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  for (let i = 0; i < 24; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};
```

Note: Excludes ambiguous characters (0, O, l, 1, I) for easier sharing.
