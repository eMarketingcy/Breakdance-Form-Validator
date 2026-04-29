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
 *
 * Phone field country selector:
 *   Requires phone-countries.js (loaded before this file) which exposes the
 *   global BFV_COUNTRIES array. When present, a flag + dial-code button is
 *   injected to the left of the phone input. Selecting a country sets the
 *   correct international prefix and forces the customer to include it.
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
    : { firstName: 'fields[first_name]', lastName: 'fields[last_name]', phone: 'fields[phone]', email: 'fields[email]' },

  // ── Name field rules ──────────────────────────────────────────────────────
  NAME_ALLOWED_CHARS_REGEX : /^[A-Za-zÀ-ɏЀ-ӿ\s'\-]+$/,
  NAME_FORBIDDEN_KEY_REGEX : /[^A-Za-zÀ-ɏЀ-ӿ\s'\-]/,
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

  CYRILLIC_TEST_REGEX  : /[Ѐ-ӿ]/,
  CYRILLIC_STRIP_REGEX : /[Ѐ-ӿ]/g,

  // ── Country selector ──────────────────────────────────────────────────────
  DEFAULT_COUNTRY : (typeof bfvConfig !== 'undefined' && bfvConfig.defaultCountry)
    ? bfvConfig.defaultCountry
    : 'US',

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

    // Tracks the currently selected dial code for the phone field.
    this._phoneDial = null;

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

  _setupNameField( field ) {
    if ( ! field ) return;

    field.addEventListener( 'beforeinput', ( e ) => {
      if ( ! e.data ) return;
      if ( CONFIG.NAME_FORBIDDEN_KEY_REGEX.test( e.data ) ) {
        e.preventDefault();
      }
    } );

    field.addEventListener( 'keydown', ( e ) => {
      if ( this._isControlKey( e ) ) return;
      if ( e.ctrlKey || e.metaKey )  return;
      if ( CONFIG.NAME_FORBIDDEN_KEY_REGEX.test( e.key ) ) {
        e.preventDefault();
      }
    } );

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

  _setupPhoneField( field ) {
    if ( ! field ) return;

    field.setAttribute( 'type', 'tel' );

    // Country selector — injected before the input event listeners so the
    // wrapped DOM structure is in place when the listeners are attached.
    if ( typeof BFV_COUNTRIES !== 'undefined' && BFV_COUNTRIES.length ) {
      this._buildPhoneSelector( field );
    }

    // ── Layer 1: beforeinput ─────────────────────────────────────────────
    field.addEventListener( 'beforeinput', ( e ) => {
      if ( ! e.data ) return;
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
      const raw     = field.value;
      const hasPlus = raw.startsWith( '+' );
      const digits  = raw.replace( /\D/g, '' );
      field.value   = hasPlus ? '+' + digits : digits;
      this._clearError( field );
    } );
  }

  _setupEmailField( field ) {
    if ( ! field ) return;

    field.addEventListener( 'beforeinput', ( e ) => {
      if ( ! e.data ) return;
      if ( CONFIG.CYRILLIC_TEST_REGEX.test( e.data ) ) {
        e.preventDefault();
      }
    } );

    field.addEventListener( 'keydown', ( e ) => {
      if ( CONFIG.CYRILLIC_TEST_REGEX.test( e.key ) ) {
        e.preventDefault();
      }
    } );

    field.addEventListener( 'input', () => {
      if ( CONFIG.CYRILLIC_TEST_REGEX.test( field.value ) ) {
        field.value = field.value.replace( CONFIG.CYRILLIC_STRIP_REGEX, '' );
      }
      this._clearError( field );
    } );
  }

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

  // ── Private: Country Selector ────────────────────────────────────────────

  /**
   * Builds and injects the flag + dial-code country selector to the left of
   * the phone input. Wraps the input in a flex container (.bfv-phone-wrap)
   * so the button and input appear as a single unified control.
   *
   * The selector forces customers to explicitly choose their country, which
   * automatically prepends the correct international dial code to the phone
   * input value before submission.
   *
   * @param {HTMLInputElement} field — The phone input element.
   */
  _buildPhoneSelector( field ) {

    // ── Wrapper ────────────────────────────────────────────────────────────
    const wrap = document.createElement( 'div' );
    wrap.className = 'bfv-phone-wrap';
    field.parentNode.insertBefore( wrap, field );
    wrap.appendChild( field );

    // ── Trigger button ─────────────────────────────────────────────────────
    const btn = document.createElement( 'button' );
    btn.type      = 'button';
    btn.className = 'bfv-country-btn';
    btn.setAttribute( 'aria-haspopup', 'listbox' );
    btn.setAttribute( 'aria-expanded', 'false' );

    const flagEl  = document.createElement( 'span' );
    flagEl.className = 'bfv-flag';
    flagEl.setAttribute( 'aria-hidden', 'true' );

    const dialEl  = document.createElement( 'span' );
    dialEl.className = 'bfv-dial';

    const caretEl = document.createElement( 'span' );
    caretEl.className = 'bfv-caret';
    caretEl.setAttribute( 'aria-hidden', 'true' );
    caretEl.textContent = '▾';

    btn.append( flagEl, dialEl, caretEl );

    // ── Dropdown panel ─────────────────────────────────────────────────────
    const dropdown = document.createElement( 'div' );
    dropdown.className = 'bfv-country-dropdown';
    dropdown.hidden    = true;

    const searchEl = document.createElement( 'input' );
    searchEl.type          = 'text';
    searchEl.className     = 'bfv-country-search';
    searchEl.placeholder   = 'Search country or dial code…';
    searchEl.setAttribute( 'autocomplete', 'off' );
    searchEl.setAttribute( 'aria-label',   'Search countries' );

    const list = document.createElement( 'ul' );
    list.className = 'bfv-country-list';
    list.setAttribute( 'role',       'listbox' );
    list.setAttribute( 'aria-label', 'Countries' );

    dropdown.append( searchEl, list );

    // Insert button and dropdown before the input inside the wrapper
    wrap.insertBefore( btn,      field );
    wrap.insertBefore( dropdown, field );

    // ── Helpers ────────────────────────────────────────────────────────────

    const renderList = ( countries ) => {
      list.innerHTML = '';

      if ( ! countries.length ) {
        const empty = document.createElement( 'li' );
        empty.className   = 'bfv-country-no-results';
        empty.textContent = 'No results found.';
        list.appendChild( empty );
        return;
      }

      const frag = document.createDocumentFragment();
      countries.forEach( ( [ code, name, dial ] ) => {
        const li = document.createElement( 'li' );
        li.dataset.code = code;
        li.setAttribute( 'role',     'option' );
        li.setAttribute( 'tabindex', '-1' );

        const f = document.createElement( 'span' );
        f.className = 'bfv-flag';
        f.setAttribute( 'aria-hidden', 'true' );
        f.textContent = this._flagEmoji( code );

        const n = document.createElement( 'span' );
        n.className   = 'bfv-country-name';
        n.textContent = name;

        const d = document.createElement( 'span' );
        d.className   = 'bfv-country-dial';
        d.textContent = dial;

        li.append( f, n, d );
        frag.appendChild( li );
      } );
      list.appendChild( frag );
    };

    // Marks the active item in the visible list without re-rendering.
    const markActive = ( code ) => {
      list.querySelectorAll( 'li[data-code]' ).forEach( ( li ) => {
        li.classList.toggle( 'bfv-active', li.dataset.code === code );
      } );
    };

    const selectCountry = ( country, updateField = true ) => {
      const [ code, name, dial ] = country;

      flagEl.textContent = this._flagEmoji( code );
      dialEl.textContent = dial;
      btn.setAttribute( 'aria-label', `Country: ${ name } ${ dial }. Click to change.` );

      if ( updateField ) {
        const old = this._phoneDial || '';
        const cur = field.value;

        if ( ! cur || cur === old ) {
          field.value = dial;
        } else if ( old && cur.startsWith( old ) ) {
          // Preserve local digits the user already typed.
          field.value = dial + cur.slice( old.length );
        } else {
          field.value = dial;
        }
      }

      this._phoneDial = dial;
      this._selectedCountryCode = code;
      markActive( code );
    };

    const openDropdown = () => {
      renderList( BFV_COUNTRIES );
      markActive( this._selectedCountryCode );
      dropdown.hidden = false;
      btn.setAttribute( 'aria-expanded', 'true' );
      searchEl.value = '';
      searchEl.focus();

      requestAnimationFrame( () => {
        const active = list.querySelector( '.bfv-active' );
        if ( active ) active.scrollIntoView( { block: 'nearest' } );
      } );
    };

    const closeDropdown = () => {
      dropdown.hidden = true;
      btn.setAttribute( 'aria-expanded', 'false' );
    };

    // ── Initial state ──────────────────────────────────────────────────────

    renderList( BFV_COUNTRIES );

    // If the input already has a value with a dial code, detect and select it.
    let initialCountry = BFV_COUNTRIES.find( ( c ) => c[ 0 ] === CONFIG.DEFAULT_COUNTRY )
                      || BFV_COUNTRIES.find( ( c ) => c[ 0 ] === 'US' )
                      || BFV_COUNTRIES[ 0 ];

    if ( field.value && field.value.startsWith( '+' ) ) {
      // Sort longest dial codes first so +1868 matches before +1.
      const sorted  = BFV_COUNTRIES.slice().sort( ( a, b ) => b[ 2 ].length - a[ 2 ].length );
      const matched = sorted.find( ( c ) => field.value.startsWith( c[ 2 ] ) );
      if ( matched ) initialCountry = matched;
    }

    selectCountry( initialCountry, false );

    // Pre-fill the dial code only when the field is empty.
    if ( ! field.value ) {
      field.value      = initialCountry[ 2 ];
      this._phoneDial  = initialCountry[ 2 ];
    }

    // ── Event: open / close ────────────────────────────────────────────────
    btn.addEventListener( 'click', ( e ) => {
      e.stopPropagation();
      dropdown.hidden ? openDropdown() : closeDropdown();
    } );

    // ── Event: search filter ───────────────────────────────────────────────
    searchEl.addEventListener( 'input', () => {
      const q        = searchEl.value.trim().toLowerCase();
      const filtered = q
        ? BFV_COUNTRIES.filter( ( [ code, name, dial ] ) =>
            name.toLowerCase().includes( q ) ||
            dial.includes( q ) ||
            code.toLowerCase().startsWith( q )
          )
        : BFV_COUNTRIES;
      renderList( filtered );
      markActive( this._selectedCountryCode );
    } );

    // ── Event: select country from list ───────────────────────────────────
    list.addEventListener( 'click', ( e ) => {
      const li = e.target.closest( 'li[data-code]' );
      if ( ! li ) return;
      const country = BFV_COUNTRIES.find( ( c ) => c[ 0 ] === li.dataset.code );
      if ( country ) {
        selectCountry( country );
        closeDropdown();
        field.focus();
      }
    } );

    // ── Event: keyboard navigation ─────────────────────────────────────────
    searchEl.addEventListener( 'keydown', ( e ) => {
      if ( e.key === 'ArrowDown' ) {
        e.preventDefault();
        const first = list.querySelector( 'li[data-code]' );
        if ( first ) first.focus();
      } else if ( e.key === 'Enter' ) {
        e.preventDefault();
        const first = list.querySelector( 'li[data-code]' );
        if ( first ) first.click();
      } else if ( e.key === 'Escape' ) {
        closeDropdown();
        btn.focus();
      }
    } );

    list.addEventListener( 'keydown', ( e ) => {
      const items   = [ ...list.querySelectorAll( 'li[data-code]' ) ];
      const focused = document.activeElement;
      const idx     = items.indexOf( focused );

      if ( e.key === 'ArrowDown' ) {
        e.preventDefault();
        if ( idx < items.length - 1 ) items[ idx + 1 ].focus();
      } else if ( e.key === 'ArrowUp' ) {
        e.preventDefault();
        if ( idx > 0 ) items[ idx - 1 ].focus();
        else searchEl.focus();
      } else if ( e.key === 'Enter' || e.key === ' ' ) {
        e.preventDefault();
        if ( focused && focused.dataset && focused.dataset.code ) focused.click();
      } else if ( e.key === 'Escape' ) {
        closeDropdown();
        btn.focus();
      }
    } );

    // ── Event: close on outside click ─────────────────────────────────────
    document.addEventListener( 'click', ( e ) => {
      if ( ! wrap.contains( e.target ) ) closeDropdown();
    } );
  }

  /**
   * Converts a 2-letter ISO country code to its emoji flag representation
   * using Unicode Regional Indicator Symbols (U+1F1E6 … U+1F1FF).
   *
   * @param  {string} code — e.g. 'US', 'GR'
   * @return {string} Emoji flag, e.g. '🇺🇸'
   */
  _flagEmoji( code ) {
    return [ ...code.toUpperCase() ]
      .map( ( c ) => String.fromCodePoint( 0x1F1E6 + c.charCodeAt( 0 ) - 65 ) )
      .join( '' );
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

    const digits = field.value.replace( /\D/g, '' );

    if ( digits.length < CONFIG.PHONE_MIN_DIGITS ) return false;

    // When the country selector is active, ensure the user typed local digits
    // beyond the country code (i.e. the field is not just the dial code itself).
    if ( this._phoneDial ) {
      const dialDigits = this._phoneDial.replace( /\D/g, '' ).length;
      if ( digits.length <= dialDigits ) return false;
    }

    return true;
  }

  _validateEmailField( field ) {
    if ( ! field ) return true;
    return CONFIG.EMAIL_REGEX.test( field.value.trim() );
  }

  // ── Private: Error Tooltip UI ────────────────────────────────────────────

  /**
   * Shows an error tooltip after the field (or after its .bfv-phone-wrap
   * wrapper when the country selector is present).
   */
  _showError( field ) {
    // For the phone field, anchor the tooltip after the whole wrap div so it
    // appears below the combined selector+input row, not mid-widget.
    const anchor = ( field.parentElement && field.parentElement.classList.contains( 'bfv-phone-wrap' ) )
      ? field.parentElement
      : field;

    if ( anchor.nextElementSibling && anchor.nextElementSibling.classList.contains( CONFIG.TOOLTIP_CLASS ) ) {
      return;
    }

    const tooltip = document.createElement( 'span' );
    tooltip.className   = CONFIG.TOOLTIP_CLASS;
    tooltip.textContent = CONFIG.ERROR_MESSAGE;
    tooltip.setAttribute( 'role',      'alert' );
    tooltip.setAttribute( 'aria-live', 'assertive' );
    anchor.insertAdjacentElement( 'afterend', tooltip );
    field.classList.add( CONFIG.ERROR_CLASS );
    field.setAttribute( 'aria-invalid', 'true' );
  }

  _clearError( field ) {
    if ( ! field ) return;
    field.classList.remove( CONFIG.ERROR_CLASS );
    field.removeAttribute( 'aria-invalid' );

    const anchor = ( field.parentElement && field.parentElement.classList.contains( 'bfv-phone-wrap' ) )
      ? field.parentElement
      : field;

    const next = anchor.nextElementSibling;
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
   ============================================================================= */

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

// A) Run immediately.
initForms();

// B) DOMContentLoaded fallback.
if ( document.readyState === 'loading' ) {
  document.addEventListener( 'DOMContentLoaded', initForms );
}

// C) MutationObserver for dynamically-injected forms (popups, modals, etc.).
if ( typeof MutationObserver !== 'undefined' ) {
  const observer = new MutationObserver( initForms );
  observer.observe( document.documentElement, { childList: true, subtree: true } );
}
