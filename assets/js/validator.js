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
  // Breakdance wraps each form in an element with this class.
  // If your theme or Breakdance version uses a different selector, update here.
  FORM_SELECTOR: (typeof bfvConfig !== 'undefined' && bfvConfig.formSelector)
    ? bfvConfig.formSelector
    : '.breakdance-form',

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
  // Characters allowed in name fields.
  // Unicode ranges: \u0041-\u007A  = basic Latin letters (A-z)
  //                 \u00C0-\u024F  = Latin Extended (accented chars)
  //                 \u0400-\u04FF  = Cyrillic block
  // Non-letter allowed: hyphen (-), apostrophe ('), space ( )
  NAME_ALLOWED_CHARS_REGEX : /^[\u0041-\u007A\u00C0-\u024F\u0400-\u04FFa-zA-Z\s'\-]+$/i,

  // Regex used on keydown to BLOCK individual forbidden characters.
  // Blocks: digits 0-9, and all common special/punctuation characters.
  // Any character NOT in the allowed set above will be blocked here.
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

  // ── Email field rules ─────────────────────────────────────────────────────
  // Standard email validation: must have chars@chars.chars
  EMAIL_REGEX : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,

  // Unicode range for the Cyrillic script block (U+0400 – U+04FF).
  // Used to block Cyrillic characters from being typed into the email field.
  CYRILLIC_REGEX : /[\u0400-\u04FF]/,

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
   * @param {HTMLFormElement} formEl — The specific form DOM element to validate.
   */
  constructor( formEl ) {
    this.form = formEl;

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
      if ( this._isControlKey( e ) ) return; // Always allow navigation/editing keys.
      if ( CONFIG.NAME_BLOCKED_KEY_REGEX.test( e.key ) ) {
        e.preventDefault(); // Silently swallow the keystroke.
      }
    } );

    // Enforce max length and clear error on valid input change.
    field.addEventListener( 'input', () => {
      // Truncate silently if pasted content exceeds max length.
      if ( field.value.length > CONFIG.NAME_MAX_LENGTH ) {
        field.value = field.value.slice( 0, CONFIG.NAME_MAX_LENGTH );
      }
      // Clear the error tooltip as soon as the user starts correcting.
      this._clearError( field );
    } );
  }

  /**
   * Forces the phone input to type="tel" (improves mobile numeric keyboard)
   * and blocks any non-numeric keystrokes.
   * @param {HTMLInputElement|null} field
   */
  _setupPhoneField( field ) {
    if ( ! field ) return;

    // Dynamically ensure the input type is "tel" regardless of how
    // Breakdance rendered it in the DOM.
    field.setAttribute( 'type', 'tel' );

    // Block non-numeric key presses.
    field.addEventListener( 'keydown', ( e ) => {
      if ( this._isControlKey( e ) ) return;
      if ( e.ctrlKey || e.metaKey )  return; // Allow copy/paste shortcuts.

      // Allow digit keys (both main keyboard and numpad).
      const isDigit = ( e.key >= '0' && e.key <= '9' ) || e.code.startsWith( 'Numpad' );
      if ( ! isDigit ) {
        e.preventDefault();
      }
    } );

    field.addEventListener( 'input', () => this._clearError( field ) );
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

    // Also sanitise pasted Cyrillic content.
    field.addEventListener( 'input', () => {
      if ( CONFIG.CYRILLIC_REGEX.test( field.value ) ) {
        // Strip all Cyrillic characters that may have been pasted in.
        field.value = field.value.replace( CONFIG.CYRILLIC_REGEX, '' );
      }
      this._clearError( field );
    } );
  }

  /**
   * Intercepts the form's submit event.
   * Runs all validation checks and shows errors or allows submission.
   */
  _setupSubmitInterception() {
    this.form.addEventListener( 'submit', ( e ) => {

      // Clear all existing error tooltips before a fresh validation pass.
      this._clearAllErrors();

      const errors = this._runAllValidations();

      if ( errors.length > 0 ) {
        // Block the native form submission (and thus Breakdance's submit handler).
        e.preventDefault();
        e.stopImmediatePropagation(); // Prevent Breakdance's listener from firing.

        // Show a tooltip next to every invalid field.
        errors.forEach( ( field ) => this._showError( field ) );

        // Scroll to and focus the first invalid field for accessibility.
        errors[ 0 ].focus( { preventScroll: false } );
      }
      // If errors is empty, do nothing — allow normal submission to proceed.
    }, true ); // `true` = capture phase, runs before Breakdance's bubble-phase listener.
  }

  // ── Private: Validation Logic ────────────────────────────────────────────

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

    // Filter out nulls (fields not found in the DOM).
    return invalid.filter( Boolean );
  }

  /**
   * Validates a name field: must be non-empty, meet length constraints,
   * and contain only allowed characters.
   * @param {HTMLInputElement|null} field
   * @returns {boolean} true = valid.
   */
  _validateNameField( field ) {
    if ( ! field ) return true; // Skip if field doesn't exist on this form.

    const val = field.value.trim();

    if ( val.length < CONFIG.NAME_MIN_LENGTH ) return false;
    if ( val.length > CONFIG.NAME_MAX_LENGTH ) return false;
    if ( ! CONFIG.NAME_ALLOWED_CHARS_REGEX.test( val ) ) return false;

    return true;
  }

  /**
   * Validates the phone field: must be non-empty.
   * Character blocking is handled at keydown; we just check presence here.
   * @param {HTMLInputElement|null} field
   * @returns {boolean}
   */
  _validatePhoneField( field ) {
    if ( ! field ) return true;
    return field.value.trim().length > 0;
  }

  /**
   * Validates the email field: must match the standard email regex.
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
    // Guard: don't add a duplicate tooltip.
    if ( field.nextElementSibling && field.nextElementSibling.classList.contains( CONFIG.TOOLTIP_CLASS ) ) {
      return;
    }

    const tooltip = document.createElement( 'span' );
    tooltip.className   = CONFIG.TOOLTIP_CLASS;
    tooltip.textContent = CONFIG.ERROR_MESSAGE;
    tooltip.setAttribute( 'role', 'alert' ); // Accessibility: announce to screen readers.
    tooltip.setAttribute( 'aria-live', 'assertive' );

    // Insert the tooltip immediately after the input in the DOM.
    field.insertAdjacentElement( 'afterend', tooltip );

    // Apply the error highlight class to the input itself.
    field.classList.add( CONFIG.ERROR_CLASS );
    field.setAttribute( 'aria-invalid', 'true' );
  }

  /**
   * Removes the error tooltip and highlight class from a single field.
   * Called on 'input' events so the UI clears as the user corrects the field.
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
   * Called at the beginning of each submit attempt for a clean slate.
   */
  _clearAllErrors() {
    Object.values( this.fields ).forEach( ( field ) => this._clearError( field ) );
  }

  // ── Private: Helpers ─────────────────────────────────────────────────────

  /**
   * Finds an input element within this form by its `name` attribute.
   * @param {string} name — The value of the name attribute.
   * @returns {HTMLInputElement|null}
   */
  _findField( name ) {
    return this.form.querySelector( `input[name="${ name }"], textarea[name="${ name }"]` );
  }

  /**
   * Returns true if the key event represents a control/navigation key
   * that should never be blocked (Backspace, arrows, Tab, etc.).
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
   ============================================================================= */

document.addEventListener( 'DOMContentLoaded', () => {

  const forms = document.querySelectorAll( CONFIG.FORM_SELECTOR );

  if ( forms.length === 0 ) {
    // No Breakdance forms found — exit silently. Nothing to validate.
    return;
  }

  forms.forEach( ( formEl ) => {
    // Each form gets its own isolated validator instance.
    new BreakdanceFormValidator( formEl );
  } );

} );
