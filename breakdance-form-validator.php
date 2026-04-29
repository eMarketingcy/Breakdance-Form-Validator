<?php
/**
 * Plugin Name:       Breakdance Form Validator
 * Plugin URI:        https://example.com/breakdance-form-validator
 * Description:       Lightweight, modular front-end validation for Breakdance Builder native forms. Validates name, phone, and email fields with strict character rules and custom tooltips.
 * Version:           1.3.0
 * Author:            Your Name
 * License:           GPL-2.0+
 * Text Domain:       breakdance-form-validator
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'BFV_VERSION',    '1.3.0' );
define( 'BFV_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'BFV_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

require_once BFV_PLUGIN_DIR . 'includes/class-bfv-admin.php';
require_once BFV_PLUGIN_DIR . 'includes/class-bfv-assets.php';

$bfv_admin  = new BFV_Admin();
$bfv_admin->register();

$bfv_assets = new BFV_Assets();
$bfv_assets->register();
