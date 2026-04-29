<?php
/**
 * Class BFV_Assets
 *
 * Responsible for registering and enqueueing all front-end assets
 * (CSS and JS) for the Breakdance Form Validator plugin.
 *
 * @package Breakdance_Form_Validator
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class BFV_Assets {

    /**
     * Register WordPress hooks.
     * Call this method from the main plugin file after instantiation.
     */
    public function register() {
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_frontend_assets' ) );
    }

    /**
     * Enqueue front-end scripts and styles.
     *
     * Hooked to 'wp_enqueue_scripts' — fires on all public-facing pages.
     * The script is loaded in the footer to ensure the DOM is ready and
     * Breakdance's own scripts have already loaded.
     */
    public function enqueue_frontend_assets() {

        wp_enqueue_style(
            'bfv-validator-style',
            BFV_PLUGIN_URL . 'assets/css/validator.css',
            array(),
            BFV_VERSION
        );

        wp_enqueue_script(
            'bfv-validator-script',
            BFV_PLUGIN_URL . 'assets/js/validator.js',
            array(),
            BFV_VERSION,
            true
        );

        wp_localize_script(
            'bfv-validator-script',
            'bfvConfig',
            $this->get_js_config()
        );
    }

    /**
     * Returns the configuration array serialised and passed to the front end
     * as the `bfvConfig` global JS object.
     *
     * All values are filterable so themes or child plugins can override them
     * without editing this file:
     *
     *   add_filter( 'bfv_js_config', function( $config ) {
     *       $config['formSelector'] = '.my-custom-form';
     *       return $config;
     *   } );
     *
     * @return array
     */
    private function get_js_config() {
        $config = array(
            // CSS selector used to find all Breakdance forms on the page.
            // Targets both the native Breakdance wrapper (.bde-form) and the
            // legacy custom class (.breakdance-form) in one comma-separated string.
            // The JS bootstrap resolves the actual <form> element from whatever
            // element the selector returns, handling wrapper-div patterns correctly.
            'formSelector'   => '.bde-form, .breakdance-form',

            // Attribute used to identify field purpose.
            // These must match the `name` attribute on your Breakdance form inputs.
            // Check field names in Breakdance's form editor or by inspecting the HTML.
            'fieldNames'     => array(
                'firstName' => 'first-name',
                'lastName'  => 'last-name',
                'phone'     => 'phone',
                'email'     => 'email',
            ),

            // The exact message shown in the error tooltip.
            'errorMessage'   => __( '! Please correct this field.', 'breakdance-form-validator' ),

            // Minimum and maximum character length for name fields.
            'nameMinLength'  => 2,
            'nameMaxLength'  => 30,

            // Minimum number of digits required for a valid phone number.
            // 7 is the shortest real-world local number.
            'phoneMinDigits' => 7,
        );

        /**
         * Filter the JS config array before it is passed to the front end.
         *
         * @param array $config Associative array of configuration values.
         */
        return apply_filters( 'bfv_js_config', $config );
    }
}
