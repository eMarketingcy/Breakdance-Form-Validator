<?php
/**
 * Plugin Name:       Breakdance Form Validator
 * Plugin URI:        https://example.com/breakdance-form-validator
 * Description:       Lightweight, modular front-end validation for Breakdance Builder native forms. Validates name, phone, and email fields with strict character rules and custom tooltips.
 * Version:           1.1.0
 * Author:            Your Name
 * License:           GPL-2.0+
 * Text Domain:       breakdance-form-validator
 */

// Exit if accessed directly — security best practice.
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Define plugin constants for clean path/URL references throughout the codebase.
define( 'BFV_VERSION',     '1.1.0' );
define( 'BFV_PLUGIN_DIR',  plugin_dir_path( __FILE__ ) );
define( 'BFV_PLUGIN_URL',  plugin_dir_url( __FILE__ ) );

// Load the asset enqueuer class.
require_once BFV_PLUGIN_DIR . 'includes/class-bfv-assets.php';

// Instantiate and register the enqueuer.
$bfv_assets = new BFV_Assets();
$bfv_assets->register();
