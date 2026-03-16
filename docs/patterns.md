# Patterns

## Naming Conventions

- Web files: kebab-case (except `main.jsx` and `app.jsx`)
- API modules: camelCase
- Database tables/columns: snake_case

## Theme System

The application uses a CSS variables-based theming system to support Light and Dark modes.

### Usage

Use the defined CSS custom properties for all colors. **Do not use hex codes directly.**

```css
.my-component {
  background: var(--surface-card);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}
```

### Key Variables

| Variable | Description |
|---|---|
| `--bg-primary` | Main page background |
| `--surface-card` | Card/Container background |
| `--text-primary` | Main text color |
| `--text-muted` | Secondary/Help text |
| `--accent-blue` | Primary brand color (Buttons, Links) |
| `--border-color` | Default border color |

### Adding New Components

1.  **Always use variables**: Check `apps/web/src/styles/index.css` for available variables.
2.  **Test both modes**: Toggle the theme using the header button to verify.
3.  **Icons**: Use `currentColor` for stroke/fill or `var(--color-name)` if specific color is needed.

### Architecture

-   **State**: Managed by `useTheme` hook and `ThemeProvider` context.
-   **Persistence**: `localStorage` key `it-hub-theme`.
-   **System Detection**: `matchMedia('(prefers-color-scheme: dark)')`.
-   **Flash Prevention**: Inline script in `index.html` applies theme before React loads.

## Mobile Responsiveness

IT-Hub follows a mobile-first design strategy for operationally critical tasks (approvals, maintenance rounds).

### Key Patterns

1. **Touch Targets**: All interactive elements (buttons, inputs, links) MUST have a minimum touch target size of 44x44px. Use `var(--touch-target-min, 44px)` in CSS.
2. **Responsive Layouts**:
   - **Desktop**: High-density tables and sidebars.
   - **Mobile**: Stackable cards and bottom/drawer-based navigation.
3. **Modal/Dialogs**: Use the `MobileModal` component which automatically transitions to full-screen on mobile devices for improved focus and reachability.
4. **Mobile Hooks**: Use `useMediaQuery` or the `useIsMobile` convenience hook for conditional rendering of layouts.

### Usage Example

```jsx
import { useIsMobile } from 'shared/hooks/useMediaQuery';
import { MobileModal } from 'shared/ui/MobileModal/MobileModal';

function MyPage() {
    const isMobile = useIsMobile();
    return isMobile ? <CardLayout /> : <TableLayout />;
}
```
