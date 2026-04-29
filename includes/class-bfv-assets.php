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

    public function register() {
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_frontend_assets' ) );
    }

    public function enqueue_frontend_assets() {

        wp_enqueue_style(
            'bfv-validator-style',
            BFV_PLUGIN_URL . 'assets/css/validator.css',
            array(),
            BFV_VERSION
        );

        wp_enqueue_script(
            'bfv-phone-countries',
            BFV_PLUGIN_URL . 'assets/js/phone-countries.js',
            array(),
            BFV_VERSION,
            true
        );

        wp_enqueue_script(
            'bfv-validator-script',
            BFV_PLUGIN_URL . 'assets/js/validator.js',
            array( 'bfv-phone-countries' ),
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
     * Builds the JS config array from saved admin settings.
     *
     * Priority order (highest → lowest):
     *   1. Values returned by the `bfv_js_config` PHP filter.
     *   2. Settings saved in the WordPress admin (bfv_settings option).
     *   3. Hard-coded defaults from BFV_Admin::get_defaults().
     *
     * @return array
     */
    private function get_js_config() {
        $s = BFV_Admin::get_settings();

        $config = array(
            'formSelector'   => $s['form_selector'],
            'fieldNames'     => array(
                'firstName' => $s['field_first_name'],
                'lastName'  => $s['field_last_name'],
                'phone'     => $s['field_phone'],
                'email'     => $s['field_email'],
            ),
            'errorMessage'   => $s['error_message'],
            'nameMinLength'  => (int) $s['name_min_length'],
            'nameMaxLength'  => (int) $s['name_max_length'],
            'phoneMinDigits' => (int) $s['phone_min_digits'],
            'defaultCountry' => $s['default_country'],
        );

        /**
         * Filter the JS config array before it is passed to the front end.
         * Values returned by this filter take priority over admin settings.
         *
         * @param array $config Associative array of configuration values.
         */
        return apply_filters( 'bfv_js_config', $config );
    }
}
