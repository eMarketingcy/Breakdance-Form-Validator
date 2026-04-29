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
│   └── class-bfv-assets.php        ← OOP asset enqueuer (PHP → JS config bridge)
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
3. That's it. The validator automatically attaches to every `.breakdance-form`
   found on any front-end page.

---

## Configuration

### Matching your Breakdance field names

Breakdance assigns a `name` attribute to each form input based on what you type
in the form builder. Open `includes/class-bfv-assets.php`, find `get_js_config()`,
and update the `fieldNames` array to match your exact field names:

```php
'fieldNames' => array(
    'firstName' => 'first-name',   // ← change to match your Breakdance field name
    'lastName'  => 'last-name',
    'phone'     => 'phone',
    'email'     => 'email',
),
```

You can find the field names in Breakdance's form editor under each field's
**Name / ID** setting, or by inspecting the rendered HTML (`<input name="...">`).

### Changing validation rules

All rules (regex patterns, length limits, error message, selectors) live in the
`CONFIG` object at the very top of `assets/js/validator.js`. Routine changes
never require touching the class logic below it.

---

## Validation Rules Summary

| Field      | Rule |
|------------|------|
| First Name | Latin + Cyrillic letters, hyphens, apostrophes, spaces only. Min 2 / Max 30 chars. Blocks digits & specials on keydown. |
| Last Name  | Same as First Name. |
| Phone      | Forced to `type="tel"`. Blocks all non-numeric keystrokes. |
| Email      | Must match `user@domain.ext`. Blocks Cyrillic on keydown and strips on paste. |

---

## What this plugin does NOT handle

The following are intentionally omitted and should be configured inside
Breakdance's UI:

- **Thank-you page redirect** after successful submission.
- **reCAPTCHA** verification.
- **Server-side validation** (always add this separately for security).
