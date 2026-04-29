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
            'field_first_name' => 'fields[first_name]',
            'field_last_name'  => 'fields[last_name]',
            'field_phone'      => 'fields[phone]',
            'field_email'      => 'fields[email]',
            'name_min_length'  => 2,
            'name_max_length'  => 30,
            'phone_min_digits' => 7,
            'default_country'  => 'US',
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
            'fields[first_name]',
            __( 'Breakdance default: fields[first_name] — check via Inspect → name="…"', 'breakdance-form-validator' )
        );

        $this->add_field(
            'field_last_name',
            __( 'Last Name field name', 'breakdance-form-validator' ),
            'bfv_section_fields',
            'text',
            'fields[last_name]',
            __( 'Breakdance default: fields[last_name]', 'breakdance-form-validator' )
        );

        $this->add_field(
            'field_phone',
            __( 'Phone field name', 'breakdance-form-validator' ),
            'bfv_section_fields',
            'text',
            'fields[phone]',
            __( 'Breakdance default: fields[phone]', 'breakdance-form-validator' )
        );

        $this->add_field(
            'field_email',
            __( 'Email field name', 'breakdance-form-validator' ),
            'bfv_section_fields',
            'text',
            'fields[email]',
            __( 'Breakdance default: fields[email]', 'breakdance-form-validator' )
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
            __( 'Total digits required (country code + local). 7 is the shortest real-world local number; with a country code the effective minimum is higher.', 'breakdance-form-validator' )
        );

        $this->add_country_field();

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
            ? $this->sanitize_field_name( $raw['field_first_name'] )
            : $defaults['field_first_name'];

        $clean['field_last_name']  = isset( $raw['field_last_name'] )
            ? $this->sanitize_field_name( $raw['field_last_name'] )
            : $defaults['field_last_name'];

        $clean['field_phone']      = isset( $raw['field_phone'] )
            ? $this->sanitize_field_name( $raw['field_phone'] )
            : $defaults['field_phone'];

        $clean['field_email']      = isset( $raw['field_email'] )
            ? $this->sanitize_field_name( $raw['field_email'] )
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

        $clean['default_country']  = isset( $raw['default_country'] )
            ? strtoupper( preg_replace( '/[^A-Za-z]/', '', sanitize_text_field( $raw['default_country'] ) ) )
            : $defaults['default_country'];

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
                        <p><?php esc_html_e( 'Breakdance Builder uses bracket notation by default:', 'breakdance-form-validator' ); ?></p>
                        <ul>
                            <li><code>fields[first_name]</code></li>
                            <li><code>fields[last_name]</code></li>
                            <li><code>fields[phone]</code></li>
                            <li><code>fields[email]</code></li>
                        </ul>
                        <p><?php esc_html_e( 'To verify, visit your page, right-click an input and choose Inspect. Look for:', 'breakdance-form-validator' ); ?></p>
                        <code>&lt;input name="<strong>fields[first_name]</strong>" ...&gt;</code>
                        <p style="margin-top:10px"><?php esc_html_e( 'If your field uses a custom Name / ID in the Breakdance editor, use that exact value instead.', 'breakdance-form-validator' ); ?></p>
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
     * Registers the Default Country select field in the Validation Rules section.
     */
    private function add_country_field() {
        $settings = self::get_settings();
        $current  = isset( $settings['default_country'] ) ? $settings['default_country'] : 'US';

        add_settings_field(
            'bfv_default_country',
            __( 'Default country (phone)', 'breakdance-form-validator' ),
            function() use ( $current ) {
                $name      = esc_attr( self::OPTION_KEY . '[default_country]' );
                $countries = self::country_list();
                echo '<select name="' . $name . '">';
                foreach ( $countries as $code => $label ) {
                    printf(
                        '<option value="%s"%s>%s</option>',
                        esc_attr( $code ),
                        selected( $current, $code, false ),
                        esc_html( $label )
                    );
                }
                echo '</select>';
                echo '<p class="description">' . esc_html__(
                    'Pre-selected country in the phone field country selector. Customers can change it at any time.',
                    'breakdance-form-validator'
                ) . '</p>';
            },
            self::PAGE_SLUG,
            'bfv_section_rules'
        );
    }

    /**
     * Returns the list of countries shown in the admin Default Country select.
     *
     * @return array<string,string> ISO code => display label
     */
    private static function country_list() {
        return array(
            'AF' => 'Afghanistan (+93)',
            'AL' => 'Albania (+355)',
            'DZ' => 'Algeria (+213)',
            'AD' => 'Andorra (+376)',
            'AO' => 'Angola (+244)',
            'AG' => 'Antigua and Barbuda (+1268)',
            'AR' => 'Argentina (+54)',
            'AM' => 'Armenia (+374)',
            'AU' => 'Australia (+61)',
            'AT' => 'Austria (+43)',
            'AZ' => 'Azerbaijan (+994)',
            'BS' => 'Bahamas (+1242)',
            'BH' => 'Bahrain (+973)',
            'BD' => 'Bangladesh (+880)',
            'BB' => 'Barbados (+1246)',
            'BY' => 'Belarus (+375)',
            'BE' => 'Belgium (+32)',
            'BZ' => 'Belize (+501)',
            'BJ' => 'Benin (+229)',
            'BT' => 'Bhutan (+975)',
            'BO' => 'Bolivia (+591)',
            'BA' => 'Bosnia and Herzegovina (+387)',
            'BW' => 'Botswana (+267)',
            'BR' => 'Brazil (+55)',
            'BN' => 'Brunei (+673)',
            'BG' => 'Bulgaria (+359)',
            'BF' => 'Burkina Faso (+226)',
            'BI' => 'Burundi (+257)',
            'CV' => 'Cabo Verde (+238)',
            'KH' => 'Cambodia (+855)',
            'CM' => 'Cameroon (+237)',
            'CA' => 'Canada (+1)',
            'CF' => 'Central African Republic (+236)',
            'TD' => 'Chad (+235)',
            'CL' => 'Chile (+56)',
            'CN' => 'China (+86)',
            'CO' => 'Colombia (+57)',
            'KM' => 'Comoros (+269)',
            'CG' => 'Congo (+242)',
            'CD' => 'Congo DRC (+243)',
            'CR' => 'Costa Rica (+506)',
            'HR' => 'Croatia (+385)',
            'CU' => 'Cuba (+53)',
            'CY' => 'Cyprus (+357)',
            'CZ' => 'Czech Republic (+420)',
            'DK' => 'Denmark (+45)',
            'DJ' => 'Djibouti (+253)',
            'DM' => 'Dominica (+1767)',
            'DO' => 'Dominican Republic (+1809)',
            'EC' => 'Ecuador (+593)',
            'EG' => 'Egypt (+20)',
            'SV' => 'El Salvador (+503)',
            'GQ' => 'Equatorial Guinea (+240)',
            'ER' => 'Eritrea (+291)',
            'EE' => 'Estonia (+372)',
            'SZ' => 'Eswatini (+268)',
            'ET' => 'Ethiopia (+251)',
            'FJ' => 'Fiji (+679)',
            'FI' => 'Finland (+358)',
            'FR' => 'France (+33)',
            'GA' => 'Gabon (+241)',
            'GM' => 'Gambia (+220)',
            'GE' => 'Georgia (+995)',
            'DE' => 'Germany (+49)',
            'GH' => 'Ghana (+233)',
            'GR' => 'Greece (+30)',
            'GD' => 'Grenada (+1473)',
            'GT' => 'Guatemala (+502)',
            'GN' => 'Guinea (+224)',
            'GW' => 'Guinea-Bissau (+245)',
            'GY' => 'Guyana (+592)',
            'HT' => 'Haiti (+509)',
            'HN' => 'Honduras (+504)',
            'HK' => 'Hong Kong (+852)',
            'HU' => 'Hungary (+36)',
            'IS' => 'Iceland (+354)',
            'IN' => 'India (+91)',
            'ID' => 'Indonesia (+62)',
            'IR' => 'Iran (+98)',
            'IQ' => 'Iraq (+964)',
            'IE' => 'Ireland (+353)',
            'IL' => 'Israel (+972)',
            'IT' => 'Italy (+39)',
            'JM' => 'Jamaica (+1876)',
            'JP' => 'Japan (+81)',
            'JO' => 'Jordan (+962)',
            'KZ' => 'Kazakhstan (+7)',
            'KE' => 'Kenya (+254)',
            'KI' => 'Kiribati (+686)',
            'XK' => 'Kosovo (+383)',
            'KW' => 'Kuwait (+965)',
            'KG' => 'Kyrgyzstan (+996)',
            'LA' => 'Laos (+856)',
            'LV' => 'Latvia (+371)',
            'LB' => 'Lebanon (+961)',
            'LS' => 'Lesotho (+266)',
            'LR' => 'Liberia (+231)',
            'LY' => 'Libya (+218)',
            'LI' => 'Liechtenstein (+423)',
            'LT' => 'Lithuania (+370)',
            'LU' => 'Luxembourg (+352)',
            'MO' => 'Macau (+853)',
            'MG' => 'Madagascar (+261)',
            'MW' => 'Malawi (+265)',
            'MY' => 'Malaysia (+60)',
            'MV' => 'Maldives (+960)',
            'ML' => 'Mali (+223)',
            'MT' => 'Malta (+356)',
            'MH' => 'Marshall Islands (+692)',
            'MR' => 'Mauritania (+222)',
            'MU' => 'Mauritius (+230)',
            'MX' => 'Mexico (+52)',
            'FM' => 'Micronesia (+691)',
            'MD' => 'Moldova (+373)',
            'MC' => 'Monaco (+377)',
            'MN' => 'Mongolia (+976)',
            'ME' => 'Montenegro (+382)',
            'MA' => 'Morocco (+212)',
            'MZ' => 'Mozambique (+258)',
            'MM' => 'Myanmar (+95)',
            'NA' => 'Namibia (+264)',
            'NR' => 'Nauru (+674)',
            'NP' => 'Nepal (+977)',
            'NL' => 'Netherlands (+31)',
            'NZ' => 'New Zealand (+64)',
            'NI' => 'Nicaragua (+505)',
            'NE' => 'Niger (+227)',
            'NG' => 'Nigeria (+234)',
            'KP' => 'North Korea (+850)',
            'MK' => 'North Macedonia (+389)',
            'NO' => 'Norway (+47)',
            'OM' => 'Oman (+968)',
            'PK' => 'Pakistan (+92)',
            'PW' => 'Palau (+680)',
            'PS' => 'Palestine (+970)',
            'PA' => 'Panama (+507)',
            'PG' => 'Papua New Guinea (+675)',
            'PY' => 'Paraguay (+595)',
            'PE' => 'Peru (+51)',
            'PH' => 'Philippines (+63)',
            'PL' => 'Poland (+48)',
            'PT' => 'Portugal (+351)',
            'PR' => 'Puerto Rico (+1787)',
            'QA' => 'Qatar (+974)',
            'RO' => 'Romania (+40)',
            'RU' => 'Russia (+7)',
            'RW' => 'Rwanda (+250)',
            'KN' => 'Saint Kitts and Nevis (+1869)',
            'LC' => 'Saint Lucia (+1758)',
            'VC' => 'Saint Vincent and the Grenadines (+1784)',
            'WS' => 'Samoa (+685)',
            'SM' => 'San Marino (+378)',
            'ST' => 'Sao Tome and Principe (+239)',
            'SA' => 'Saudi Arabia (+966)',
            'SN' => 'Senegal (+221)',
            'RS' => 'Serbia (+381)',
            'SC' => 'Seychelles (+248)',
            'SL' => 'Sierra Leone (+232)',
            'SG' => 'Singapore (+65)',
            'SK' => 'Slovakia (+421)',
            'SI' => 'Slovenia (+386)',
            'SB' => 'Solomon Islands (+677)',
            'SO' => 'Somalia (+252)',
            'ZA' => 'South Africa (+27)',
            'KR' => 'South Korea (+82)',
            'SS' => 'South Sudan (+211)',
            'ES' => 'Spain (+34)',
            'LK' => 'Sri Lanka (+94)',
            'SD' => 'Sudan (+249)',
            'SR' => 'Suriname (+597)',
            'SE' => 'Sweden (+46)',
            'CH' => 'Switzerland (+41)',
            'SY' => 'Syria (+963)',
            'TW' => 'Taiwan (+886)',
            'TJ' => 'Tajikistan (+992)',
            'TZ' => 'Tanzania (+255)',
            'TH' => 'Thailand (+66)',
            'TL' => 'Timor-Leste (+670)',
            'TG' => 'Togo (+228)',
            'TO' => 'Tonga (+676)',
            'TT' => 'Trinidad and Tobago (+1868)',
            'TN' => 'Tunisia (+216)',
            'TR' => 'Turkey (+90)',
            'TM' => 'Turkmenistan (+993)',
            'TV' => 'Tuvalu (+688)',
            'UG' => 'Uganda (+256)',
            'UA' => 'Ukraine (+380)',
            'AE' => 'United Arab Emirates (+971)',
            'GB' => 'United Kingdom (+44)',
            'US' => 'United States (+1)',
            'UY' => 'Uruguay (+598)',
            'UZ' => 'Uzbekistan (+998)',
            'VU' => 'Vanuatu (+678)',
            'VE' => 'Venezuela (+58)',
            'VN' => 'Vietnam (+84)',
            'YE' => 'Yemen (+967)',
            'ZM' => 'Zambia (+260)',
            'ZW' => 'Zimbabwe (+263)',
        );
    }

    /**
     * Sanitizes a field name attribute value.
     *
     * sanitize_key() strips brackets, which breaks Breakdance's fields[name]
     * notation. This method allows lowercase alphanumerics, hyphens, underscores,
     * and square brackets so both formats work: plain ("email") and bracket
     * notation ("fields[email]").
     *
     * @param string $value Raw input value.
     * @return string
     */
    private function sanitize_field_name( $value ) {
        $value = strtolower( sanitize_text_field( $value ) );
        $value = preg_replace( '/[^a-z0-9_\-\[\]]/', '', $value );
        return $value;
    }

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
