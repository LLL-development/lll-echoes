# WallViewer Bug Investigation Report

**Date:** 2026-08-05
**File:** src/components/wall/WallViewer.tsx
**Investigator:** Recon (code analysis layer)

---

## Bug 1: Visitors can see Settings, Delete, Share buttons and Toolbar

### Finding: No race condition in hasEditToken — the real issue is llowContributions

### 1. hasEditToken initialization (line 74)

`	sx
const [hasEditToken, setHasEditToken] = useState(false);
`

**Initial value is alse.** There is no race condition where it starts as 	rue.

### 2. localStorage read useEffect (lines 76-80)

`	sx
useEffect(() => {
  if (typeof window === 'undefined') return;
  const token = localStorage.getItem(\echoes_edit_token_\\);
  setHasEditToken(!!token);
}, [wall.slug]);
`

This reads from localStorage on mount. If a stale token exists for this wall's slug, hasEditToken will become 	rue on the client. This is a **potential cause** — if a visitor's browser has a leftover token from a previous owner visit (same device, same wall slug), they would see owner controls.

### 3. ?edit_token= URL parameter handler (lines 132-145)

`	sx
useEffect(() => {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const editToken = params.get('edit_token');
  if (editToken) {
    localStorage.setItem(\echoes_edit_token_\\, editToken);
    setHasEditToken(true);
    params.delete('edit_token');
    const remaining = params.toString();
    const cleanUrl = \\\\\;
    window.history.replaceState({}, '', cleanUrl);
  }
}, [wall.slug]);
`

This handler only runs when ?edit_token= is present in the URL. It sets the token to localStorage AND sets hasEditToken to 	rue synchronously. This is correct behavior for the owner who receives a share link.

### 4. Where hasEditToken is checked in JSX

| Location | Code | Condition |
|----------|------|-----------|
| Line 665 | {hasEditToken && ( | Settings + Delete buttons |
| Line 755 | {hasEditToken && ( | Desktop share button |
| Line 805 | {hasEditToken \|\| allowContributions && ( | Empty canvas "add note" button |
| Line 1024 | {hasEditToken && ( | Mobile share button |
| Line 1092 | {(hasEditToken \|\| allowContributions) && ( | Side panel toggle button |

### 5. Root cause analysis

**The Settings and Delete buttons (line 665) and Share buttons (lines 755, 1024) are correctly gated behind {hasEditToken && (...)}.** They should NOT be visible to visitors unless hasEditToken is 	rue.

**However, the Toolbar (side panel) and the empty-canvas "add note" button are gated behind {hasEditToken \|\| allowContributions}:**

- **Line 805:** {!isPlayground && (hasEditToken || allowContributions) && ( — "Add note" button on empty canvas
- **Line 1092:** {(hasEditToken || allowContributions) && ( — Side panel toggle button

This means **when llowContributions === true**, visitors can see the toolbar and add notes — which is the intended behavior for contribution mode.

**Conclusion for Bug 1:**
- **Settings/Delete/Share buttons:** These are correctly gated by hasEditToken alone. If visitors see them, the cause is one of:
  1. **Stale localStorage token** — line 78 reads echoes_edit_token_{wall.slug} from localStorage. If the owner previously visited on this browser, the token persists.
  2. **?edit_token= in URL** — line 137 sets hasEditToken = true immediately.
  3. **No race condition** — useState(false) on line 74 confirms initial value is alse.
- **Toolbar (side panel):** Correctly shows when llowContributions === true. This is intentional behavior, not a bug.
- **Empty canvas "Add note" button:** Same as toolbar — shows when llowContributions === true. Intentional.

---

## Bug 2: Share button icon is missing

### Finding: SVG code is correct — icon likely hidden by CSS or rendering issue

### 1. Desktop share button SVG (lines 772-774)

`	sx
<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
</svg>
`

### 2. Mobile share button SVG (lines 1037-1039)

`	sx
<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
</svg>
`

### 3. SVG code comparison

**Both SVGs are identical.** The d attribute (share icon path) is the same. The SVG markup is correct.

### 4. Button styling (desktop, lines 761-769)

`	sx
className="rounded-lg p-2 text-white"
style={{
  backgroundColor: '#775537',
  boxShadow: isPlayground
    ? '0 3px 0 #5a3f2a'
    : '0 3px 0 #5a3f2a, 0 4px 8px rgba(119,85,55,0.2)',
  opacity: isPlayground ? 0.45 : 1,
  cursor: isPlayground ? 'not-allowed' : 'pointer',
}}
`

### 5. Potential causes for missing icon

1. **stroke="currentColor" with 	ext-white**: The SVG uses stroke="currentColor" which inherits from the button's 	ext-white class. This should render white strokes on a brown background — visible.
2. **No CSS hiding the SVG**: No opacity: 0, display: none, or isibility: hidden found on the SVG or its parent.
3. **Tailwind w-5 h-5**: Standard 20px size — should be visible.
4. **Possible Tailwind JIT issue**: If the w-5 h-5 utility classes are not being generated (e.g., if Tailwind's content paths don't include this file), the SVG would have zero dimensions. However, this is unlikely since other SVGs in the same file render correctly.
5. **ill="none" with no stroke color**: If currentColor resolves to an unexpected value (e.g., transparent), the stroke would be invisible. This could happen if there's a CSS rule overriding color on the SVG or its ancestors.

### 6. What was NOT checked (out of scope)

- Actual browser rendering (no DOM inspection possible)
- Tailwind CSS build output / generated styles
- Global CSS rules that might affect SVG rendering
- SharePanel component internals (line 1183-1193) — only the button trigger was checked

---

## Summary of Findings

| Bug | Root Cause | Confidence |
|-----|-----------|------------|
| **1: Owner controls visible to visitors** | Settings/Delete/Share are correctly gated by hasEditToken. If visible, cause is **stale localStorage token** (line 78) or **?edit_token= in URL** (line 137). No race condition. | High |
| **1: Toolbar visible to visitors** | Intentional — gated by {hasEditToken \|\| allowContributions} (line 1092). When llowContributions === true, visitors can add notes. | High |
| **2: Share icon missing** | SVG code is correct and identical in both desktop/mobile. Likely a **CSS rendering issue** (stroke color inheritance, Tailwind class generation, or global CSS override). Cannot confirm without browser inspection. | Medium (code is correct, issue is in CSS/rendering layer) |

## Recommended Next Steps

1. **For Bug 1:** Add server-side ownership verification before rendering owner controls, or add a check that the current user is the wall owner (not just the token holder). Consider clearing stale tokens on 401 responses from the API.
2. **For Bug 2:** Inspect the rendered SVG in browser DevTools to check computed styles (color, stroke-width, visibility). Verify Tailwind is generating the w-5 h-5 utilities. Check if any global CSS rule targets svg elements.
