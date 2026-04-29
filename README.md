# Breakdance Form Validator

A lightweight, modular WordPress plugin that adds strict front-end validation
to Breakdance Builder's native form module.

---

## Folder Structure

```
breakdance-form-validator/
│
├── breakdance-form-validator.php   ← Plugin entry point (header, constants, bootstrap)
│
├── includes/
│   └── class-bfv-assets.php        ← OOP asset enqueuer + PHP → JS config bridge
│
└── assets/
    ├── css/
    │   └── validator.css           ← Tooltip & error-field styles
    └── js/
        └── validator.js            ← Config-driven ES6 class validator
```

---

## Installation

1. Upload the `breakdance-form-validator/` folder to `/wp-content/plugins/`.
2. Activate the plugin from **Plugins → Installed Plugins** in the WordPress admin.
3. That's it. The validator automatically attaches to every Breakdance form
   found on any front-end page.

---

## How Breakdance Forms Are Detected

Breakdance Builder renders its form widget inside a wrapper `<div class="bde-form">`.
The plugin targets **both** of these selectors by default:

```
.bde-form, .breakdance-form
```

The JavaScript bootstrap automatically resolves the actual `<form>` element from
whichever element the selector returns, so it works whether the selector hits a
wrapper div or the form element directly.

If your Breakdance version uses a different class, update `formSelector` in
`includes/class-bfv-assets.php` → `get_js_config()`, or use the filter:

```php
add_filter( 'bfv_js_config', function( $config ) {
    $config['formSelector'] = '.my-custom-selector';
    return $config;
} );
```

You can also add the class `breakdance-form` manually to any form widget's
CSS Classes field inside the Breakdance editor as an alternative.

---

## Configuration

### Admin Settings Page (recommended)

Go to **Settings → BF Validator** in the WordPress dashboard. All plugin options
are available there — no code editing needed. The sidebar on that page also explains
how to find your form selector and field names by inspecting the rendered HTML.

### Matching your Breakdance field names (code alternative)

If you prefer to configure via code, use the PHP filter described below.
You can find field names in Breakdance's form editor under each field's
**Name / ID** setting, or by inspecting the rendered HTML (`<input name="...">`).

### Using the PHP filter

All config values can be overridden from your theme's `functions.php` without
editing the plugin:

```php
add_filter( 'bfv_js_config', function( $config ) {
    $config['errorMessage']   = 'Please fix this field.';
    $config['nameMinLength']  = 3;
    $config['phoneMinDigits'] = 10; // enforce full national number
    return $config;
} );
```

### Changing validation rules

All rules (regex patterns, length limits, error message, selectors) also live in
the `CONFIG` object at the top of `assets/js/validator.js`. Routine changes never
require touching the class logic below it.

---

## Validation Rules Summary

| Field      | Rule |
|------------|------|
| First Name | Latin + Latin Extended + Cyrillic letters, hyphens, apostrophes, spaces only. Min 2 / Max 30 chars. Blocks digits & special chars on keydown. |
| Last Name  | Same as First Name. |
| Phone      | `type="tel"` forced. Digits and a leading `+` only (paste is auto-sanitised). Minimum 7 digits required. |
| Email      | Must match `user@domain.ext`. Blocks and strips Cyrillic characters (all occurrences, including pasted). |

---

## Extending

### Adding a new field type

1. Add a new entry to `FIELD_NAMES` in the `CONFIG` object in `validator.js`.
2. Add a `_setupXxxField()` and `_validateXxxField()` method to the class.
3. Call both from `_init()` and `_runAllValidations()` respectively.
4. Add the new field name to `fieldNames` in `get_js_config()` in `class-bfv-assets.php`.

---

## What this plugin does NOT handle

The following are intentionally omitted and should be configured inside
Breakdance's UI:

- **Thank-you page redirect** after successful submission.
- **reCAPTCHA** verification.
- **Server-side validation** (always add this separately for security).

---

## Changelog

### 1.3.0 — 2026-04-29

**Bug Fixes**

- **Character blocking did not work on desktop for any input method other than
  physical keyboard**: `keydown` only fires for hardware key presses — it is
  completely bypassed by right-click paste, drag-and-drop text, browser autofill,
  speech input, and browser extensions that inject values. The same gap existed on
  mobile for IME composition. Added `beforeinput` as the primary blocking layer:
  it fires before the DOM changes for *every* input method on every platform, and
  `e.preventDefault()` cleanly stops the insertion. `keydown` is kept as a fallback
  for older browsers. The existing `input` handler (layer 3) remains as a final
  safety net. This triple-layer defence now reliably blocks letters in the phone
  field and digits in the name fields everywhere.

- **Cyrillic blocking in email alternated between working and not working on
  desktop**: The shared `CYRILLIC_REGEX` used the `g` flag. In JavaScript, a
  regex with `g` is stateful — calling `.test()` advances `lastIndex`, so every
  other `.test()` call on the same regex object returns the wrong result. Split
  into `CYRILLIC_TEST_REGEX` (no `g`, used for `.test()`) and
  `CYRILLIC_STRIP_REGEX` (with `g`, used for `.replace()`).

- **Plugin did not initialise on fast desktop connections**: When the script was
  served from cache, it executed *after* `DOMContentLoaded` had already fired.
  The sole `DOMContentLoaded` listener never ran. Fixed with three complementary
  bootstrap mechanisms:
  1. **Immediate run** — `initForms()` is called as soon as the script parses,
     catching forms already in the DOM regardless of `readyState`.
  2. **DOMContentLoaded fallback** — still attached when `readyState === 'loading'`,
     for the minority case where the script loads before parsing finishes.
  3. **MutationObserver** — watches for Breakdance forms added to the DOM after
     initial load (popup forms, tab-switched content, modals). A `WeakSet` tracks
     already-initialised containers so observers never double-attach.

- **`NAME_BLOCKED_KEY_REGEX` used in `keydown` did not match `NAME_STRIP_REGEX`
  used in `input`**: The two were defined independently and could drift. Unified
  to a single source of truth: `NAME_FORBIDDEN_KEY_REGEX` (no `g`) for `.test()`
  in `keydown` and `beforeinput`, and `NAME_STRIP_REGEX` (with `g`) for
  `.replace()` in `input`.

- **`keydown` name handler missing `Ctrl`/`Meta` guard**: Unlike the phone handler,
  the name `keydown` handler did not have `if (e.ctrlKey || e.metaKey) return`.
  Fixed so keyboard shortcuts (Ctrl+A, Ctrl+Z, etc.) are never accidentally blocked.

---

### 1.2.0 — 2026-04-29

**Bug Fixes**

- **Name fields accepted digits and special chars via paste / mobile IME**: The
  `keydown` handler blocked forbidden characters during typing but the `input`
  handler never stripped them when they arrived via paste, drag-and-drop, autofill,
  or mobile IME composition. Added a `NAME_STRIP_REGEX` constant (the complement of
  `NAME_ALLOWED_CHARS_REGEX`) and applied it in the `input` handler so only letters,
  spaces, hyphens, and apostrophes can ever appear in a name field, regardless of
  how the content was entered. Cursor position is preserved after stripping.

- **Phone field: same bypass possible on mobile / paste**: Confirmed the existing
  `input` handler already sanitises phone values — no additional fix needed beyond
  name fields above.

**New Features**

- **WordPress Admin Settings Page** (`Settings → BF Validator`): All plugin
  configuration is now manageable through the WordPress dashboard without touching
  any code. Configurable settings:
  - Form CSS selector (how the plugin finds Breakdance forms)
  - Field name / ID for each of the four fields (first name, last name, phone, email)
  - Name minimum and maximum character length
  - Phone minimum digit count
  - Error tooltip message text
- Settings are stored in the database via the WordPress Settings API and read
  automatically by the asset enqueuer.
- Built-in sidebar with instructions for finding field names and form selectors.
- PHP filter `bfv_js_config` still works and takes priority over admin settings.

---

### 1.1.0 — 2026-04-29

**Bug Fixes**

- **CRITICAL — Form selector never matched**: Default selector was `.breakdance-form`
  which Breakdance does not add to any element by default. Changed to
  `.bde-form, .breakdance-form` to target Breakdance's actual wrapper class.

- **CRITICAL — Submit listener on wrapper div**: When the selector returned a wrapper
  `<div>`, the `submit` event listener was bound to the div (which never fires a
  submit event). The bootstrap now resolves the actual `<form>` element from the
  matched container before instantiating the validator.

- **CRITICAL — Submit interception bypassed by Breakdance AJAX**: Added a secondary
  click-phase listener on the submit button to catch cases where Breakdance binds
  its AJAX handler to the button click instead of the form's submit event.

- **Cyrillic regex missing `g` flag**: `/[Ѐ-ӿ]/` replaced only the first
  Cyrillic character when stripping pasted content. Fixed to use the `g` flag so
  all occurrences are removed.

- **Phone field: `+` key was blocked**: International phone numbers (e.g. `+30 210…`)
  could not be typed. The `+` key is now explicitly allowed.

- **Phone numpad detection too broad**: `e.code.startsWith('Numpad')` allowed
  `NumpadAdd`, `NumpadSubtract`, `NumpadDecimal`, etc. Fixed to whitelist only the
  ten numpad digit codes.

- **Phone paste not sanitised**: Pasted content containing letters, spaces, or
  punctuation was not stripped. The `input` handler now auto-sanitises the value,
  keeping only digits and a leading `+`.

- **Phone validation accepted a single digit**: `_validatePhoneField` only checked
  `length > 0`. Now enforces a configurable minimum digit count (default: 7).

- **Name regex allowed non-letter ASCII characters**: The range `A-z`
  (A→z) includes `[`, `\`, `]`, `^`, `_`, `` ` `` (ASCII 91–96) between Z and a.
  Fixed to use the explicit ranges `A-Z` and `a-z`.

**Improvements**

- Added a `bfv_js_config` WordPress filter so themes and child plugins can override
  any configuration value without editing plugin files.

- Added `phoneMinDigits` as a configurable option (default: 7).

- Extracted validation logic into a shared `_handleValidation()` method to avoid
  duplication between submit and click interception paths.

- Translated the default `errorMessage` string through `__()` so it is localisable.

- CSS: changed `.bfv-tooltip` from `position: relative` to `position: absolute`
  so that `z-index: 9999` actually creates a stacking context and the tooltip
  overlays content correctly.

- `_findField()` now searches the outer container element (not just the inner
  `<form>`) to handle Breakdance widget structures where inputs may be rendered
  inside the wrapper but outside the `<form>` tag.

---

### 1.0.0 — initial release

- Initial release with basic front-end validation for name, phone, and email fields.
