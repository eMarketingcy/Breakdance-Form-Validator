/**
 * Breakdance Form Validator — validator.js
 *
 * Provides strict, client-side validation for Breakdance Builder native forms.
 * Architecture:
 *   - A central CONFIG object at the top controls all rules (edit here only).
 *   - A BreakdanceFormValidator class encapsulates all logic.
 *   - initForms() at the bottom bootstraps the class safely on both desktop and mobile.
 *
 * Input blocking uses a three-layer defence that covers every input method
 * on every platform (desktop keyboard, paste, drag-and-drop, autofill, mobile IME):
 *   1. beforeinput  — fires before the DOM changes; e.preventDefault() blocks cleanly.
 *   2. keydown      — older-browser fallback for physical key presses.
 *   3. input        — final safety net; strips anything that slipped through layers 1-2.
 */

/* =============================================================================
   1. CENTRAL CONFIGURATION
   ============================================================================= */

const CONFIG = {

  // ── Selectors ─────────────────────────────────────────────────────────────
  FORM_SELECTOR: (typeof bfvConfig !== 'undefined' && bfvConfig.formSelector)
    ? bfvConfig.formSelector
    : '.bde-form, .breakdance-form',

  FIELD_NAMES: (typeof bfvConfig !== 'undefined' && bfvConfig.fieldNames)
    ? bfvConfig.fieldNames
    : { firstName: 'first-name', lastName: 'last-name', phone: 'phone', email: 'email' },

  // ── Name field rules ──────────────────────────────────────────────────────
  // Full-value validation regex (no `g` flag — used with ^ and $).
  NAME_ALLOWED_CHARS_REGEX : /^[A-Za-zÀ-ɏЀ-ӿ\s'\-]+$/,

  // Used with e.key in keydown — tests a single character, NO `g` flag.
  // (A regex with `g` is stateful and alternates results on repeated .test() calls.)
  NAME_FORBIDDEN_KEY_REGEX : /[^A-Za-zÀ-ɏЀ-ӿ\s'\-]/,

  // Used in the `input` handler to strip everything that should not be there.
  // `g` flag is correct here because we call .replace(), not .test().
  NAME_STRIP_REGEX         : /[^A-Za-zÀ-ɏЀ-ӿ\s'\-]/g,

  NAME_MIN_LENGTH : (typeof bfvConfig !== 'undefined') ? Number( bfvConfig.nameMinLength )  : 2,
  NAME_MAX_LENGTH : (typeof bfvConfig !== 'undefined') ? Number( bfvConfig.nameMaxLength )  : 30,

  // ── Phone field rules ─────────────────────────────────────────────────────
  PHONE_ALLOWED_CONTROL_KEYS : [
    'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight',
    'ArrowUp',   'ArrowDown', 'Home', 'End', 'Tab',
  ],

  PHONE_MIN_DIGITS : (typeof bfvConfig !== 'undefined' && bfvConfig.phoneMinDigits)
    ? Number( bfvConfig.phoneMinDigits )
    : 7,

  // ── Email field rules ─────────────────────────────────────────────────────
  EMAIL_REGEX : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,

  // Two separate Cyrillic regexes — one without `g` for .test(), one with `g` for .replace().
  // NEVER share a single /g regex between .test() calls — it has stateful lastIndex
  // that causes every other call to return the wrong result.
  CYRILLIC_TEST_REGEX  : /[Ѐ-ӿ]/,
  CYRILLIC_STRIP_REGEX : /[Ѐ-ӿ]/g,

  // ── Error tooltip ─────────────────────────────────────────────────────────
  ERROR_MESSAGE : (typeof bfvConfig !== 'undefined' && bfvConfig.errorMessage)
    ? bfvConfig.errorMessage
    : '! Please correct this field.',

  TOOLTIP_CLASS : 'bfv-tooltip',
  ERROR_CLASS   : 'bfv-field-error',
};


/* =============================================================================
   2. VALIDATOR CLASS
   ============================================================================= */

class BreakdanceFormValidator {

  /**
   * @param {HTMLFormElement} formEl      — The actual <form> DOM element.
   * @param {HTMLElement}     containerEl — The matched container (may equal formEl).
   */
  constructor( formEl, containerEl ) {
    this.form      = formEl;
    this.container = containerEl || formEl;

    this.fields = {
      firstName : this._findField( CONFIG.FIELD_NAMES.firstName ),
      lastName  : this._findField( CONFIG.FIELD_NAMES.lastName ),
      phone     : this._findField( CONFIG.FIELD_NAMES.phone ),
      email     : this._findField( CONFIG.FIELD_NAMES.email ),
    };

    this._init();
  }

  // ── Private: Initialisation ──────────────────────────────────────────────

  _init() {
    this._setupNameField( this.fields.firstName );
    this._setupNameField( this.fields.lastName );
    this._setupPhoneField( this.fields.phone );
    this._setupEmailField( this.fields.email );
    this._setupSubmitInterception();
  }

  // ── Private: Field Setup ─────────────────────────────────────────────────

  /**
   * Name field — three-layer defence against forbidden characters.
   *
   * Layer 1: beforeinput (desktop + mobile, ALL input methods)
   *   `e.data` is the exact text about to be inserted. Testing it before the
   *   DOM changes and calling preventDefault() is the cleanest, most reliable
   *   block available in modern browsers. Covers keyboard, paste, drag-drop,
   *   autofill, and speech input in a single handler.
   *
   * Layer 2: keydown (older browser fallback)
   *   Physical key presses only. Still useful for browsers that predate
   *   beforeinput support (Firefox < 87, older mobile WebViews).
   *
   * Layer 3: input (final safety net)
   *   Strips anything that reached the field despite layers 1 and 2.
   *   Handles edge-cases like programmatic value assignment or browser
   *   extensions that modify input contents.
   */
  _setupNameField( field ) {
    if ( ! field ) return;

    // ── Layer 1: beforeinput ─────────────────────────────────────────────
    field.addEventListener( 'beforeinput', ( e ) => {
      // e.data is null for deletions, arrow keys, selections — let those through.
      if ( ! e.data ) return;
      if ( CONFIG.NAME_FORBIDDEN_KEY_REGEX.test( e.data ) ) {
        e.preventDefault();
      }
    } );

    // ── Layer 2: keydown ─────────────────────────────────────────────────
    field.addEventListener( 'keydown', ( e ) => {
      if ( this._isControlKey( e ) ) return;
      if ( e.ctrlKey || e.metaKey )  return; // Allow Ctrl+C, Ctrl+V, Ctrl+A, etc.
      if ( CONFIG.NAME_FORBIDDEN_KEY_REGEX.test( e.key ) ) {
        e.preventDefault();
      }
    } );

    // ── Layer 3: input ───────────────────────────────────────────────────
    field.addEventListener( 'input', () => {
      const stripped = field.value.replace( CONFIG.NAME_STRIP_REGEX, '' );
      if ( stripped !== field.value ) {
        const cursor    = field.selectionStart;
        const removed   = field.value.length - stripped.length;
        field.value     = stripped;
        const newCursor = Math.max( 0, cursor - removed );
        field.setSelectionRange( newCursor, newCursor );
      }
      if ( field.value.length > CONFIG.NAME_MAX_LENGTH ) {
        field.value = field.value.slice( 0, CONFIG.NAME_MAX_LENGTH );
      }
      this._clearError( field );
    } );
  }

  /**
   * Phone field — same three-layer defence.
   * Allows digits (0-9) and an optional leading `+` for international codes.
   * The input handler re-formats the value to enforce "leading + only" rule
   * regardless of how the content arrived.
   */
  _setupPhoneField( field ) {
    if ( ! field ) return;

    field.setAttribute( 'type', 'tel' );

    // ── Layer 1: beforeinput ─────────────────────────────────────────────
    field.addEventListener( 'beforeinput', ( e ) => {
      if ( ! e.data ) return;
      // Allow if ALL characters in the inserted chunk are digits or `+`.
      if ( /[^0-9+]/.test( e.data ) ) {
        e.preventDefault();
      }
    } );

    // ── Layer 2: keydown ─────────────────────────────────────────────────
    field.addEventListener( 'keydown', ( e ) => {
      if ( this._isControlKey( e ) ) return;
      if ( e.ctrlKey || e.metaKey )  return;
      if ( e.key === '+' ) return;
      if ( e.key >= '0' && e.key <= '9' ) return;
      const numpadDigits = [
        'Numpad0','Numpad1','Numpad2','Numpad3','Numpad4',
        'Numpad5','Numpad6','Numpad7','Numpad8','Numpad9',
      ];
      if ( numpadDigits.includes( e.code ) ) return;
      e.preventDefault();
    } );

    // ── Layer 3: input ───────────────────────────────────────────────────
    field.addEventListener( 'input', () => {
      const raw      = field.value;
      const hasPlus  = raw.startsWith( '+' );
      const digits   = raw.replace( /\D/g, '' );
      field.value    = hasPlus ? '+' + digits : digits;
      this._clearError( field );
    } );
  }

  /**
   * Email field — blocks and strips Cyrillic characters.
   * Uses two separate regexes to avoid the stateful-lastIndex bug that
   * occurs when a /g regex is used with .test() across multiple calls.
   */
  _setupEmailField( field ) {
    if ( ! field ) return;

    // ── Layer 1: beforeinput ─────────────────────────────────────────────
    field.addEventListener( 'beforeinput', ( e ) => {
      if ( ! e.data ) return;
      if ( CONFIG.CYRILLIC_TEST_REGEX.test( e.data ) ) {
        e.preventDefault();
      }
    } );

    // ── Layer 2: keydown ─────────────────────────────────────────────────
    field.addEventListener( 'keydown', ( e ) => {
      if ( CONFIG.CYRILLIC_TEST_REGEX.test( e.key ) ) {
        e.preventDefault();
      }
    } );

    // ── Layer 3: input ───────────────────────────────────────────────────
    field.addEventListener( 'input', () => {
      if ( CONFIG.CYRILLIC_TEST_REGEX.test( field.value ) ) {
        field.value = field.value.replace( CONFIG.CYRILLIC_STRIP_REGEX, '' );
      }
      this._clearError( field );
    } );
  }

  /**
   * Submit interception — two complementary strategies.
   *
   * 1. capture-phase `submit` event — fires before Breakdance's bubble-phase handler.
   * 2. capture-phase `click` on the submit button — catches Breakdance versions that
   *    attach AJAX logic to the button click rather than the form submit event.
   */
  _setupSubmitInterception() {
    this.form.addEventListener( 'submit', ( e ) => {
      if ( ! this._handleValidation() ) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true );

    const submitBtn = this.form.querySelector( 'button[type="submit"], input[type="submit"]' );
    if ( submitBtn ) {
      submitBtn.addEventListener( 'click', ( e ) => {
        if ( ! this._handleValidation() ) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      }, true );
    }
  }

  // ── Private: Validation Logic ────────────────────────────────────────────

  _handleValidation() {
    this._clearAllErrors();
    const errors = this._runAllValidations();
    if ( errors.length > 0 ) {
      errors.forEach( ( field ) => this._showError( field ) );
      errors[ 0 ].focus( { preventScroll: false } );
      return false;
    }
    return true;
  }

  _runAllValidations() {
    const invalid = [];
    if ( ! this._validateNameField( this.fields.firstName ) ) invalid.push( this.fields.firstName );
    if ( ! this._validateNameField( this.fields.lastName ) )  invalid.push( this.fields.lastName );
    if ( ! this._validatePhoneField( this.fields.phone ) )    invalid.push( this.fields.phone );
    if ( ! this._validateEmailField( this.fields.email ) )    invalid.push( this.fields.email );
    return invalid.filter( Boolean );
  }

  _validateNameField( field ) {
    if ( ! field ) return true;
    const val = field.value.trim();
    if ( val.length < CONFIG.NAME_MIN_LENGTH ) return false;
    if ( val.length > CONFIG.NAME_MAX_LENGTH ) return false;
    if ( ! CONFIG.NAME_ALLOWED_CHARS_REGEX.test( val ) ) return false;
    return true;
  }

  _validatePhoneField( field ) {
    if ( ! field ) return true;
    return field.value.replace( /\D/g, '' ).length >= CONFIG.PHONE_MIN_DIGITS;
  }

  _validateEmailField( field ) {
    if ( ! field ) return true;
    return CONFIG.EMAIL_REGEX.test( field.value.trim() );
  }

  // ── Private: Error Tooltip UI ────────────────────────────────────────────

  _showError( field ) {
    if ( field.nextElementSibling && field.nextElementSibling.classList.contains( CONFIG.TOOLTIP_CLASS ) ) {
      return;
    }
    const tooltip = document.createElement( 'span' );
    tooltip.className   = CONFIG.TOOLTIP_CLASS;
    tooltip.textContent = CONFIG.ERROR_MESSAGE;
    tooltip.setAttribute( 'role', 'alert' );
    tooltip.setAttribute( 'aria-live', 'assertive' );
    field.insertAdjacentElement( 'afterend', tooltip );
    field.classList.add( CONFIG.ERROR_CLASS );
    field.setAttribute( 'aria-invalid', 'true' );
  }

  _clearError( field ) {
    if ( ! field ) return;
    field.classList.remove( CONFIG.ERROR_CLASS );
    field.removeAttribute( 'aria-invalid' );
    const next = field.nextElementSibling;
    if ( next && next.classList.contains( CONFIG.TOOLTIP_CLASS ) ) {
      next.remove();
    }
  }

  _clearAllErrors() {
    Object.values( this.fields ).forEach( ( field ) => this._clearError( field ) );
  }

  // ── Private: Helpers ─────────────────────────────────────────────────────

  _findField( name ) {
    return this.container.querySelector( `input[name="${ name }"], textarea[name="${ name }"]` );
  }

  _isControlKey( e ) {
    return CONFIG.PHONE_ALLOWED_CONTROL_KEYS.includes( e.key );
  }
}


/* =============================================================================
   3. BOOTSTRAP
   Attaches a validator to every Breakdance form found on the page.

   Three mechanisms are used together so no form is ever missed:

   A) Immediate run — covers the common case where the script executes after
      the DOM is already fully parsed (footer-loaded scripts on desktop often
      run after DOMContentLoaded has fired and readyState is already "complete").

   B) DOMContentLoaded fallback — for the case where the script loads before
      parsing finishes (rare with footer placement, but possible with caching).

   C) MutationObserver — watches for Breakdance forms injected dynamically
      AFTER initial load: popup/modal forms, tab-switched content, Breakdance
      popups, etc. This is the main reason the plugin would work on mobile
      (slower network → more time for DOMContentLoaded) but fail on desktop
      (fast load → DOMContentLoaded already past when script runs).
   ============================================================================= */

/**
 * Tracks already-initialised containers so MutationObserver callbacks
 * never attach a second validator to the same form.
 */
const _initialised = new WeakSet();

function initForms() {
  document.querySelectorAll( CONFIG.FORM_SELECTOR ).forEach( ( container ) => {
    if ( _initialised.has( container ) ) return;

    const formEl = ( container.tagName === 'FORM' )
      ? container
      : container.querySelector( 'form' );

    if ( ! formEl ) return;

    _initialised.add( container );
    new BreakdanceFormValidator( formEl, container );
  } );
}

// A) Run immediately — catches forms already in the DOM.
initForms();

// B) DOMContentLoaded — safety net if A ran before parsing finished.
if ( document.readyState === 'loading' ) {
  document.addEventListener( 'DOMContentLoaded', initForms );
}

// C) MutationObserver — catches forms added after initial parse
//    (Breakdance popups, modals, dynamic page builders, etc.).
if ( typeof MutationObserver !== 'undefined' ) {
  const observer = new MutationObserver( initForms );
  observer.observe( document.documentElement, { childList: true, subtree: true } );
}
