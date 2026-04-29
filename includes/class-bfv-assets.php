<?php
/**
 * Class BFV_Assets
 *
 * Responsible for registering and enqueueing all front-end assets
 * (CSS and JS) for the Breakdance Form Validator plugin.
 *
 * Using a class here prevents naming collisions and groups all
 * asset-related logic in one maintainable place.
 *
 * @package Breakdance_Form_Validator
 */

// Exit if accessed directly.
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
     * The script is loaded in the footer (last argument = true) to ensure
     * the DOM is ready and Breakdance's own scripts have already loaded.
     */
    public function enqueue_frontend_assets() {

        // ── Stylesheet ──────────────────────────────────────────────────────
        // Provides styling for the custom error tooltip.
        wp_enqueue_style(
            'bfv-validator-style',                          // Unique handle.
            BFV_PLUGIN_URL . 'assets/css/validator.css',   // File URL.
            array(),                                        // No dependencies.
            BFV_VERSION                                     // Cache-busted by version string.
        );

        // ── Main Validator Script ────────────────────────────────────────────
        wp_enqueue_script(
            'bfv-validator-script',                         // Unique handle.
            BFV_PLUGIN_URL . 'assets/js/validator.js',     // File URL.
            array(),                                        // No jQuery dependency — pure ES6.
            BFV_VERSION,                                    // Cache-busted by version string.
            true                                            // Load in footer.
        );

        // ── Inline Configuration (PHP → JS bridge) ───────────────────────────
        // wp_localize_script passes a PHP array as a JS object to the page.
        // This is the proper WordPress way to inject dynamic server-side data
        // into front-end scripts (nonces, AJAX URLs, config flags, etc.).
        //
        // The object will be available in JS as `bfvConfig`.
        wp_localize_script(
            'bfv-validator-script',
            'bfvConfig',
            $this->get_js_config()
        );
    }

    /**
     * Returns the configuration array that will be serialised and passed
     * to the front end as the `bfvConfig` global JS object.
     *
     * Keeping the config here means a developer can later make these values
     * filterable (add_filter) or dynamic (e.g. per post type) without
     * touching the JavaScript at all.
     *
     * @return array
     */
    private function get_js_config() {
        return array(
            // CSS selector used to find all Breakdance forms on the page.
            // Breakdance renders its form element with this class.
            'formSelector'   => '.breakdance-form',

            // Attribute used to identify field purpose.
            // Breakdance uses the `name` attribute on its inputs.
            // Adjust these strings if your field names differ.
            'fieldNames'     => array(
                'firstName' => 'first-name',
                'lastName'  => 'last-name',
                'phone'     => 'phone',
                'email'     => 'email',
            ),

            // The exact message shown in the error tooltip.
            'errorMessage'   => '! Please correct this field.',

            // Minimum and maximum length for name fields.
            'nameMinLength'  => 2,
            'nameMaxLength'  => 30,
        );
    }
}
