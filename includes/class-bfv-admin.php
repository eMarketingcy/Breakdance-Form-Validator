<?php
/**
 * Class BFV_Admin
 *
 * Registers a Settings page under WordPress Settings menu and persists
 * all plugin configuration to the database via the WordPress Settings API.
 *
 * Settings are stored as a single serialised array in the option `bfv_settings`.
 * Use BFV_Admin::get_settings() from any other class to read them.
 *
 * @package Breakdance_Form_Validator
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class BFV_Admin {

    const OPTION_KEY   = 'bfv_settings';
    const SETTINGS_GROUP = 'bfv_settings_group';
    const PAGE_SLUG    = 'breakdance-form-validator';

    // ── Public API ──────────────────────────────────────────────────────────

    /**
     * Register WordPress hooks. Called from the main plugin file.
     */
    public function register() {
        add_action( 'admin_menu',  array( $this, 'add_settings_page' ) );
        add_action( 'admin_init',  array( $this, 'register_settings' ) );
        add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_styles' ) );
    }

    /**
     * Returns the current settings merged with defaults so every key is
     * guaranteed to exist even before the user saves for the first time.
     *
     * @return array
     */
    public static function get_settings() {
        return wp_parse_args(
            get_option( self::OPTION_KEY, array() ),
            self::get_defaults()
        );
    }

    /**
     * Default values for every setting.
     * Changing a value here changes the out-of-the-box behaviour for new installs.
     *
     * @return array
     */
    public static function get_defaults() {
        return array(
            'form_selector'    => '.bde-form, .breakdance-form',
            'field_first_name' => 'first-name',
            'field_last_name'  => 'last-name',
            'field_phone'      => 'phone',
            'field_email'      => 'email',
            'name_min_length'  => 2,
            'name_max_length'  => 30,
            'phone_min_digits' => 7,
            'error_message'    => '! Please correct this field.',
        );
    }

    // ── Admin Menu ──────────────────────────────────────────────────────────

    public function add_settings_page() {
        add_options_page(
            __( 'Breakdance Form Validator', 'breakdance-form-validator' ),
            __( 'BF Validator', 'breakdance-form-validator' ),
            'manage_options',
            self::PAGE_SLUG,
            array( $this, 'render_settings_page' )
        );
    }

    // ── Settings Registration ───────────────────────────────────────────────

    public function register_settings() {

        register_setting(
            self::SETTINGS_GROUP,
            self::OPTION_KEY,
            array(
                'type'              => 'array',
                'sanitize_callback' => array( $this, 'sanitize_settings' ),
                'default'           => self::get_defaults(),
            )
        );

        // ── Section: Form Detection ─────────────────────────────────────────
        add_settings_section(
            'bfv_section_form',
            __( 'Form Detection', 'breakdance-form-validator' ),
            function() {
                echo '<p class="bfv-section-desc">' . esc_html__(
                    'The CSS selector used to locate Breakdance forms on the page. '
                    . 'The validator automatically resolves the actual <form> element '
                    . 'from any wrapper element the selector returns.',
                    'breakdance-form-validator'
                ) . '</p>';
            },
            self::PAGE_SLUG
        );

        $this->add_field(
            'form_selector',
            __( 'Form CSS Selector', 'breakdance-form-validator' ),
            'bfv_section_form',
            'text',
            __( 'e.g. .bde-form, .breakdance-form', 'breakdance-form-validator' ),
            __( 'Comma-separated list of CSS selectors. The plugin tries each one and attaches to all matching forms.', 'breakdance-form-validator' )
        );

        // ── Section: Field Names ────────────────────────────────────────────
        add_settings_section(
            'bfv_section_fields',
            __( 'Field Names / IDs', 'breakdance-form-validator' ),
            function() {
                echo '<p class="bfv-section-desc">' . esc_html__(
                    'Enter the exact value of the name attribute on each input as rendered '
                    . 'in the HTML. You can find these in Breakdance\'s form editor under '
                    . 'each field\'s Name / ID setting, or by right-clicking the input on '
                    . 'the front end and choosing Inspect.',
                    'breakdance-form-validator'
                ) . '</p>';
            },
            self::PAGE_SLUG
        );

        $this->add_field(
            'field_first_name',
            __( 'First Name field name', 'breakdance-form-validator' ),
            'bfv_section_fields',
            'text',
            'first-name',
            __( 'HTML: <input name="first-name" ...>', 'breakdance-form-validator' )
        );

        $this->add_field(
            'field_last_name',
            __( 'Last Name field name', 'breakdance-form-validator' ),
            'bfv_section_fields',
            'text',
            'last-name'
        );

        $this->add_field(
            'field_phone',
            __( 'Phone field name', 'breakdance-form-validator' ),
            'bfv_section_fields',
            'text',
            'phone'
        );

        $this->add_field(
            'field_email',
            __( 'Email field name', 'breakdance-form-validator' ),
            'bfv_section_fields',
            'text',
            'email'
        );

        // ── Section: Validation Rules ───────────────────────────────────────
        add_settings_section(
            'bfv_section_rules',
            __( 'Validation Rules', 'breakdance-form-validator' ),
            '__return_false',
            self::PAGE_SLUG
        );

        $this->add_field(
            'name_min_length',
            __( 'Name minimum length', 'breakdance-form-validator' ),
            'bfv_section_rules',
            'number',
            '2',
            __( 'Minimum number of characters for first and last name fields.', 'breakdance-form-validator' )
        );

        $this->add_field(
            'name_max_length',
            __( 'Name maximum length', 'breakdance-form-validator' ),
            'bfv_section_rules',
            'number',
            '30',
            __( 'Maximum number of characters for first and last name fields.', 'breakdance-form-validator' )
        );

        $this->add_field(
            'phone_min_digits',
            __( 'Phone minimum digits', 'breakdance-form-validator' ),
            'bfv_section_rules',
            'number',
            '7',
            __( 'Minimum number of digits required (leading + does not count). 7 is the shortest real-world local number.', 'breakdance-form-validator' )
        );

        // ── Section: Messages ───────────────────────────────────────────────
        add_settings_section(
            'bfv_section_messages',
            __( 'Error Message', 'breakdance-form-validator' ),
            '__return_false',
            self::PAGE_SLUG
        );

        $this->add_field(
            'error_message',
            __( 'Tooltip error message', 'breakdance-form-validator' ),
            'bfv_section_messages',
            'text',
            '! Please correct this field.',
            __( 'Text shown in the red tooltip beneath an invalid field.', 'breakdance-form-validator' )
        );
    }

    // ── Sanitization ────────────────────────────────────────────────────────

    public function sanitize_settings( $raw ) {
        $defaults = self::get_defaults();
        $clean    = array();

        $clean['form_selector']    = isset( $raw['form_selector'] )
            ? sanitize_text_field( $raw['form_selector'] )
            : $defaults['form_selector'];

        $clean['field_first_name'] = isset( $raw['field_first_name'] )
            ? sanitize_key( $raw['field_first_name'] )
            : $defaults['field_first_name'];

        $clean['field_last_name']  = isset( $raw['field_last_name'] )
            ? sanitize_key( $raw['field_last_name'] )
            : $defaults['field_last_name'];

        $clean['field_phone']      = isset( $raw['field_phone'] )
            ? sanitize_key( $raw['field_phone'] )
            : $defaults['field_phone'];

        $clean['field_email']      = isset( $raw['field_email'] )
            ? sanitize_key( $raw['field_email'] )
            : $defaults['field_email'];

        $clean['name_min_length']  = isset( $raw['name_min_length'] )
            ? absint( $raw['name_min_length'] )
            : $defaults['name_min_length'];

        $clean['name_max_length']  = isset( $raw['name_max_length'] )
            ? absint( $raw['name_max_length'] )
            : $defaults['name_max_length'];

        $clean['phone_min_digits'] = isset( $raw['phone_min_digits'] )
            ? absint( $raw['phone_min_digits'] )
            : $defaults['phone_min_digits'];

        $clean['error_message']    = isset( $raw['error_message'] )
            ? sanitize_text_field( $raw['error_message'] )
            : $defaults['error_message'];

        // Guard: min cannot exceed max for name lengths.
        if ( $clean['name_min_length'] > $clean['name_max_length'] ) {
            $clean['name_min_length'] = $clean['name_max_length'];
            add_settings_error(
                self::OPTION_KEY,
                'name_length_conflict',
                __( 'Name minimum length was adjusted because it exceeded the maximum.', 'breakdance-form-validator' ),
                'warning'
            );
        }

        return $clean;
    }

    // ── Render ──────────────────────────────────────────────────────────────

    public function render_settings_page() {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }

        $settings = self::get_settings();
        ?>
        <div class="wrap bfv-admin-wrap">

            <div class="bfv-admin-header">
                <h1><?php esc_html_e( 'Breakdance Form Validator', 'breakdance-form-validator' ); ?></h1>
                <span class="bfv-version-badge">v<?php echo esc_html( BFV_VERSION ); ?></span>
            </div>

            <div class="bfv-admin-body">

                <div class="bfv-admin-main">
                    <?php settings_errors( self::OPTION_KEY ); ?>

                    <form method="post" action="options.php">
                        <?php
                        settings_fields( self::SETTINGS_GROUP );
                        do_settings_sections( self::PAGE_SLUG );
                        submit_button( __( 'Save Settings', 'breakdance-form-validator' ) );
                        ?>
                    </form>
                </div>

                <div class="bfv-admin-sidebar">

                    <div class="bfv-card">
                        <h3><?php esc_html_e( 'How to find field names', 'breakdance-form-validator' ); ?></h3>
                        <ol>
                            <li><?php esc_html_e( 'Open your page in Breakdance editor.', 'breakdance-form-validator' ); ?></li>
                            <li><?php esc_html_e( 'Click the Form widget → select a field.', 'breakdance-form-validator' ); ?></li>
                            <li><?php esc_html_e( 'Look for the "Name / ID" setting — that value is the field name.', 'breakdance-form-validator' ); ?></li>
                        </ol>
                        <p><?php esc_html_e( 'Alternatively, visit your page, right-click on an input field and choose Inspect. Look for:', 'breakdance-form-validator' ); ?></p>
                        <code>&lt;input name="<strong>your-field-name</strong>" ...&gt;</code>
                    </div>

                    <div class="bfv-card">
                        <h3><?php esc_html_e( 'How to find the form selector', 'breakdance-form-validator' ); ?></h3>
                        <p><?php esc_html_e( 'Inspect the form on the front end. Look for the wrapper element class around the form. Common Breakdance selectors:', 'breakdance-form-validator' ); ?></p>
                        <ul>
                            <li><code>.bde-form</code> — Breakdance native</li>
                            <li><code>.breakdance-form</code> — custom class added in editor</li>
                        </ul>
                        <p><?php esc_html_e( 'You can add the class breakdance-form manually to any form widget via its CSS Classes field in the Breakdance editor.', 'breakdance-form-validator' ); ?></p>
                    </div>

                    <div class="bfv-card bfv-card--info">
                        <h3><?php esc_html_e( 'Override with PHP filter', 'breakdance-form-validator' ); ?></h3>
                        <p><?php esc_html_e( 'Settings saved here can also be overridden from functions.php:', 'breakdance-form-validator' ); ?></p>
                        <pre><code>add_filter( 'bfv_js_config', function( $cfg ) {
    $cfg['phoneMinDigits'] = 10;
    return $cfg;
} );</code></pre>
                        <p class="bfv-note"><?php esc_html_e( 'PHP filter values take priority over saved settings.', 'breakdance-form-validator' ); ?></p>
                    </div>

                </div>

            </div>
        </div>
        <?php
    }

    // ── Admin Styles ────────────────────────────────────────────────────────

    public function enqueue_admin_styles( $hook ) {
        if ( 'settings_page_' . self::PAGE_SLUG !== $hook ) {
            return;
        }
        // Inline admin styles — avoids shipping a separate admin CSS file.
        $css = '
            .bfv-admin-wrap { max-width: 1100px; }
            .bfv-admin-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #dcdcdc; }
            .bfv-admin-header h1 { margin: 0; }
            .bfv-version-badge { display: inline-block; background: #2271b1; color: #fff; font-size: 12px; font-weight: 600; padding: 2px 10px; border-radius: 20px; }
            .bfv-admin-body { display: flex; gap: 32px; align-items: flex-start; }
            .bfv-admin-main { flex: 1 1 auto; min-width: 0; }
            .bfv-admin-sidebar { flex: 0 0 300px; }
            .bfv-section-desc { color: #646970; margin: 4px 0 16px; }
            .bfv-card { background: #fff; border: 1px solid #dcdcdc; border-radius: 4px; padding: 16px 20px; margin-bottom: 16px; }
            .bfv-card h3 { margin: 0 0 10px; font-size: 14px; }
            .bfv-card ol, .bfv-card ul { margin: 8px 0 8px 16px; padding: 0; }
            .bfv-card li { margin-bottom: 6px; font-size: 13px; color: #3c434a; }
            .bfv-card code { background: #f6f7f7; padding: 2px 6px; border-radius: 3px; font-size: 12px; }
            .bfv-card pre { background: #f6f7f7; padding: 10px 12px; border-radius: 3px; overflow-x: auto; font-size: 12px; line-height: 1.6; }
            .bfv-card--info { border-left: 4px solid #2271b1; }
            .bfv-note { font-size: 12px; color: #646970; margin-top: 8px; }
            .form-table th { width: 220px; }
            .form-table .description { font-size: 12px; color: #646970; margin-top: 4px; }
            @media (max-width: 900px) { .bfv-admin-body { flex-direction: column; } .bfv-admin-sidebar { flex: 1 1 auto; width: 100%; } }
        ';
        wp_add_inline_style( 'wp-admin', $css );
    }

    // ── Helper ──────────────────────────────────────────────────────────────

    /**
     * Registers a single settings field.
     */
    private function add_field( $key, $label, $section, $type, $placeholder = '', $description = '' ) {
        $settings = self::get_settings();

        add_settings_field(
            'bfv_' . $key,
            $label,
            function() use ( $key, $type, $placeholder, $description, $settings ) {
                $value = isset( $settings[ $key ] ) ? $settings[ $key ] : '';
                $name  = esc_attr( self::OPTION_KEY . '[' . $key . ']' );

                if ( $type === 'number' ) {
                    printf(
                        '<input type="number" min="0" name="%s" value="%s" class="small-text" placeholder="%s">',
                        $name,
                        esc_attr( $value ),
                        esc_attr( $placeholder )
                    );
                } else {
                    printf(
                        '<input type="text" name="%s" value="%s" class="regular-text" placeholder="%s">',
                        $name,
                        esc_attr( $value ),
                        esc_attr( $placeholder )
                    );
                }

                if ( $description ) {
                    printf( '<p class="description">%s</p>', esc_html( $description ) );
                }
            },
            self::PAGE_SLUG,
            $section
        );
    }
}
