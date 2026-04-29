/**
 * Breakdance Form Validator — validator.js
 *
 * Provides strict, client-side validation for Breakdance Builder native forms.
 * Architecture:
 *   - A central CONFIG object at the top controls all rules (edit here only).
 *   - A BreakdanceFormValidator class encapsulates all logic.
 *   - A DOMContentLoaded listener at the bottom bootstraps the class safely.
 *
 * What this file does NOT handle (managed in Breakdance UI):
 *   - Thank-you page redirect after successful submission.
 *   - reCAPTCHA verification.
 */

/* =============================================================================
   1. CENTRAL CONFIGURATION
   All tunable rules live here. Change values in this object;
   never dig into the logic below for routine maintenance.
   ============================================================================= */

const CONFIG = {

  // ── Selectors ─────────────────────────────────────────────────────────────
  // Breakdance wraps each form in a div with class "bde-form".
  // The plugin resolves the actual <form> element from the matched container.
  // Fallback chain: PHP config → Breakdance native class → custom class.
  FORM_SELECTOR: (typeof bfvConfig !== 'undefined' && bfvConfig.formSelector)
    ? bfvConfig.formSelector
    : '.bde-form, .breakdance-form',

  // The `name` attribute values Breakdance assigns to each input.
  // Match these to the field names you set inside Breakdance's form editor.
  FIELD_NAMES: (typeof bfvConfig !== 'undefined' && bfvConfig.fieldNames)
    ? bfvConfig.fieldNames
    : {
        firstName : 'first-name',
        lastName  : 'last-name',
        phone     : 'phone',
        email     : 'email',
      },

  // ── Name field rules ──────────────────────────────────────────────────────
  // Allowed characters: Latin letters (A-Z, a-z), Latin Extended (accented),
  // Cyrillic block, hyphen, apostrophe, and space.
  // NOTE: A-Z = A-Z, a-z = a-z (avoids the [,\,],^,_,`
  //       non-letter chars that sit between Z(90) and a(97) in ASCII).
  NAME_ALLOWED_CHARS_REGEX : /^[A-Za-zÀ-ɏЀ-ӿ\s'\-]+$/,

  // Regex used on keydown to BLOCK individual forbidden characters.
  // Blocks: digits 0-9, and all common special/punctuation characters.
  NAME_BLOCKED_KEY_REGEX   : /[\d!@#$%^&*()+={}\[\]:;"<>,.?\/\\|`~]/,

  // Length constraints for first and last name.
  NAME_MIN_LENGTH : (typeof bfvConfig !== 'undefined') ? Number(bfvConfig.nameMinLength) : 2,
  NAME_MAX_LENGTH : (typeof bfvConfig !== 'undefined') ? Number(bfvConfig.nameMaxLength) : 30,

  // ── Phone field rules ─────────────────────────────────────────────────────
  // Keys that should always be allowed regardless of field type
  // (navigation, editing, clipboard shortcuts).
  PHONE_ALLOWED_CONTROL_KEYS : [
    'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight',
    'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab',
  ],

  // Minimum number of digits required for a valid phone number.
  // 7 is the shortest real-world local phone number (e.g. some Pacific islands).
  PHONE_MIN_DIGITS : (typeof bfvConfig !== 'undefined' && bfvConfig.phoneMinDigits)
    ? Number(bfvConfig.phoneMinDigits)
    : 7,

  // ── Email field rules ─────────────────────────────────────────────────────
  // Standard email validation: must have chars@chars.chars
  EMAIL_REGEX : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,

  // Unicode range for the Cyrillic script block (U+0400 – U+04FF).
  // The `g` flag is required to strip ALL Cyrillic characters from pasted content,
  // not just the first one.
  CYRILLIC_REGEX : /[Ѐ-ӿ]/g,

  // ── Error tooltip ─────────────────────────────────────────────────────────
  ERROR_MESSAGE    : (typeof bfvConfig !== 'undefined' && bfvConfig.errorMessage)
    ? bfvConfig.errorMessage
    : '! Please correct this field.',

  // CSS class applied to the tooltip element (styled in validator.css).
  TOOLTIP_CLASS    : 'bfv-tooltip',

  // CSS class applied to an input element when it has an active error.
  ERROR_CLASS      : 'bfv-field-error',
};


/* =============================================================================
   2. VALIDATOR CLASS
   Encapsulates all validation logic. One instance is created per form
   found on the page, keeping state isolated.
   ============================================================================= */

class BreakdanceFormValidator {

  /**
   * @param {HTMLFormElement} formEl      — The actual <form> DOM element to validate.
   * @param {HTMLElement}     containerEl — The matched container (may equal formEl).
   */
  constructor( formEl, containerEl ) {
    this.form      = formEl;
    this.container = containerEl || formEl;

    // Resolve all relevant input elements once at construction time.
    // Using [name="..."] attribute selectors to match Breakdance's output.
    this.fields = {
      firstName : this._findField( CONFIG.FIELD_NAMES.firstName ),
      lastName  : this._findField( CONFIG.FIELD_NAMES.lastName ),
      phone     : this._findField( CONFIG.FIELD_NAMES.phone ),
      email     : this._findField( CONFIG.FIELD_NAMES.email ),
    };

    this._init();
  }

  // ── Private: Initialisation ──────────────────────────────────────────────

  /**
   * Attaches all event listeners to the form and its fields.
   * Called once from the constructor.
   */
  _init() {
    this._setupNameField( this.fields.firstName );
    this._setupNameField( this.fields.lastName );
    this._setupPhoneField( this.fields.phone );
    this._setupEmailField( this.fields.email );
    this._setupSubmitInterception();
  }

  // ── Private: Field Setup ─────────────────────────────────────────────────

  /**
   * Attaches keystroke-blocking and length-limiting listeners to a name input.
   * @param {HTMLInputElement|null} field
   */
  _setupNameField( field ) {
    if ( ! field ) return;

    // Block forbidden characters as they are typed.
    field.addEventListener( 'keydown', ( e ) => {
      if ( this._isControlKey( e ) ) return;
      if ( CONFIG.NAME_BLOCKED_KEY_REGEX.test( e.key ) ) {
        e.preventDefault();
      }
    } );

    field.addEventListener( 'input', () => {
      // Truncate silently if pasted content exceeds max length.
      if ( field.value.length > CONFIG.NAME_MAX_LENGTH ) {
        field.value = field.value.slice( 0, CONFIG.NAME_MAX_LENGTH );
      }
      this._clearError( field );
    } );
  }

  /**
   * Forces the phone input to type="tel" (improves mobile numeric keyboard),
   * allows digits and a leading `+` for international format, and sanitises
   * pasted content by stripping disallowed characters.
   * @param {HTMLInputElement|null} field
   */
  _setupPhoneField( field ) {
    if ( ! field ) return;

    field.setAttribute( 'type', 'tel' );

    field.addEventListener( 'keydown', ( e ) => {
      if ( this._isControlKey( e ) ) return;
      if ( e.ctrlKey || e.metaKey )  return; // Allow copy/paste shortcuts.

      // Allow a leading `+` for international dialling codes.
      if ( e.key === '+' ) return;

      // Allow digit keys on the main keyboard.
      if ( e.key >= '0' && e.key <= '9' ) return;

      // Allow digit keys on the numpad only — exclude NumpadAdd, NumpadDecimal, etc.
      const numpadDigitCodes = [
        'Numpad0','Numpad1','Numpad2','Numpad3','Numpad4',
        'Numpad5','Numpad6','Numpad7','Numpad8','Numpad9',
      ];
      if ( numpadDigitCodes.includes( e.code ) ) return;

      e.preventDefault();
    } );

    // Sanitise paste: keep only digits and a leading `+`.
    field.addEventListener( 'input', () => {
      const raw      = field.value;
      const hasPlus  = raw.startsWith( '+' );
      const digitsOnly = raw.replace( /\D/g, '' );
      field.value    = hasPlus ? '+' + digitsOnly : digitsOnly;
      this._clearError( field );
    } );
  }

  /**
   * Attaches a Cyrillic-blocking listener to the email input.
   * Full format validation happens at submit time only.
   * @param {HTMLInputElement|null} field
   */
  _setupEmailField( field ) {
    if ( ! field ) return;

    // Block Cyrillic characters as they are typed.
    field.addEventListener( 'keydown', ( e ) => {
      if ( CONFIG.CYRILLIC_REGEX.test( e.key ) ) {
        e.preventDefault();
      }
    } );

    // Strip any Cyrillic that slips through via paste.
    // CYRILLIC_REGEX uses the `g` flag so ALL occurrences are removed, not just the first.
    field.addEventListener( 'input', () => {
      if ( CONFIG.CYRILLIC_REGEX.test( field.value ) ) {
        field.value = field.value.replace( CONFIG.CYRILLIC_REGEX, '' );
      }
      this._clearError( field );
    } );
  }

  /**
   * Intercepts form submission via two complementary strategies:
   *
   * 1. Native `submit` event (capture phase) — fires before Breakdance's
   *    bubble-phase handler when the user presses Enter or clicks a native button.
   *
   * 2. Submit-button `click` handler — catches cases where Breakdance attaches
   *    its AJAX logic to the button click rather than the form's submit event.
   *
   * Both paths call the same `_handleValidation` method so logic is not duplicated.
   */
  _setupSubmitInterception() {
    // Strategy 1: capture-phase form submit.
    this.form.addEventListener( 'submit', ( e ) => {
      if ( ! this._handleValidation() ) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true );

    // Strategy 2: submit button click interception.
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

  /**
   * Central validation entry point shared by both interception strategies.
   * Clears old errors, runs all checks, shows new errors.
   * @returns {boolean} true = all valid, false = at least one error shown.
   */
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

  /**
   * Runs all individual field validations.
   * @returns {Array<HTMLInputElement>} Array of invalid field elements.
   */
  _runAllValidations() {
    const invalid = [];

    if ( ! this._validateNameField( this.fields.firstName ) ) invalid.push( this.fields.firstName );
    if ( ! this._validateNameField( this.fields.lastName ) )  invalid.push( this.fields.lastName );
    if ( ! this._validatePhoneField( this.fields.phone ) )    invalid.push( this.fields.phone );
    if ( ! this._validateEmailField( this.fields.email ) )    invalid.push( this.fields.email );

    return invalid.filter( Boolean );
  }

  /**
   * Validates a name field: non-empty, within length range, allowed chars only.
   * @param {HTMLInputElement|null} field
   * @returns {boolean}
   */
  _validateNameField( field ) {
    if ( ! field ) return true;

    const val = field.value.trim();

    if ( val.length < CONFIG.NAME_MIN_LENGTH ) return false;
    if ( val.length > CONFIG.NAME_MAX_LENGTH ) return false;
    if ( ! CONFIG.NAME_ALLOWED_CHARS_REGEX.test( val ) ) return false;

    return true;
  }

  /**
   * Validates the phone field: must contain at least PHONE_MIN_DIGITS digits.
   * A leading `+` is allowed but does not count toward the digit minimum.
   * @param {HTMLInputElement|null} field
   * @returns {boolean}
   */
  _validatePhoneField( field ) {
    if ( ! field ) return true;
    const digits = field.value.replace( /\D/g, '' );
    return digits.length >= CONFIG.PHONE_MIN_DIGITS;
  }

  /**
   * Validates the email field against the standard email regex.
   * @param {HTMLInputElement|null} field
   * @returns {boolean}
   */
  _validateEmailField( field ) {
    if ( ! field ) return true;
    return CONFIG.EMAIL_REGEX.test( field.value.trim() );
  }

  // ── Private: Error Tooltip UI ────────────────────────────────────────────

  /**
   * Creates and inserts a tooltip element directly after the given field.
   * @param {HTMLInputElement} field
   */
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

  /**
   * Removes the error tooltip and highlight class from a single field.
   * @param {HTMLInputElement} field
   */
  _clearError( field ) {
    if ( ! field ) return;

    field.classList.remove( CONFIG.ERROR_CLASS );
    field.removeAttribute( 'aria-invalid' );

    const next = field.nextElementSibling;
    if ( next && next.classList.contains( CONFIG.TOOLTIP_CLASS ) ) {
      next.remove();
    }
  }

  /**
   * Clears all error tooltips from every managed field.
   */
  _clearAllErrors() {
    Object.values( this.fields ).forEach( ( field ) => this._clearError( field ) );
  }

  // ── Private: Helpers ─────────────────────────────────────────────────────

  /**
   * Finds an input (or textarea) within this form by its `name` attribute.
   * Searches the container element so fields outside the <form> tag but
   * still part of the Breakdance widget are also found.
   * @param {string} name
   * @returns {HTMLInputElement|null}
   */
  _findField( name ) {
    return this.container.querySelector( `input[name="${ name }"], textarea[name="${ name }"]` );
  }

  /**
   * Returns true if the key event is a control/navigation key that
   * should never be blocked.
   * @param {KeyboardEvent} e
   * @returns {boolean}
   */
  _isControlKey( e ) {
    return CONFIG.PHONE_ALLOWED_CONTROL_KEYS.includes( e.key );
  }
}


/* =============================================================================
   3. BOOTSTRAP
   Wait for the full DOM to be parsed, then find every Breakdance form
   on the page and attach a validator instance to each one.

   Handles two rendering patterns:
     a) FORM_SELECTOR matches the <form> element directly.
     b) FORM_SELECTOR matches a wrapper element — the actual <form> is found
        inside it. This covers Breakdance's .bde-form wrapper pattern.
   ============================================================================= */

document.addEventListener( 'DOMContentLoaded', () => {

  const containers = document.querySelectorAll( CONFIG.FORM_SELECTOR );

  if ( containers.length === 0 ) {
    return;
  }

  containers.forEach( ( container ) => {
    // Resolve the actual <form> element whether the selector hit the form
    // itself or a parent wrapper element.
    const formEl = ( container.tagName === 'FORM' )
      ? container
      : container.querySelector( 'form' );

    if ( ! formEl ) return;

    new BreakdanceFormValidator( formEl, container );
  } );

} );
