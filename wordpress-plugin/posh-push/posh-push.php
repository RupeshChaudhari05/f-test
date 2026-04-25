<?php
/**
 * Plugin Name:  Posh Push Notifications
 * Plugin URI:   https://poshnotify.com
 * Description:  Enterprise web push notifications for WordPress. Full subscriber
 *               management, geo/device targeting, A/B testing, drip automations,
 *               RSS auto-notify, and white-label branding — all from a single plugin.
 * Version:      2.0.0
 * Author:       Posh Notify
 * Author URI:   https://poshnotify.com
 * License:      GPL v2 or later
 * License URI:  https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:  posh-push
 * Domain Path:  /languages
 *
 * @package PoshPush
 */

// Security: abort if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// ── Plugin constants ─────────────────────────────────────────────────────────
define( 'POSH_PUSH_VERSION',    '2.0.0' );
define( 'POSH_PUSH_FILE',       __FILE__ );
define( 'POSH_PUSH_DIR',        plugin_dir_path( __FILE__ ) );
define( 'POSH_PUSH_URL',        plugin_dir_url( __FILE__ ) );
define( 'POSH_PUSH_OPTION_KEY', 'posh_push_settings' );

// ── Class includes ────────────────────────────────────────────────────────────
require_once POSH_PUSH_DIR . 'includes/class-posh-push-core.php';
require_once POSH_PUSH_DIR . 'includes/class-posh-push-admin.php';
require_once POSH_PUSH_DIR . 'includes/class-posh-push-frontend.php';
require_once POSH_PUSH_DIR . 'includes/class-posh-push-api.php';

// ── Lifecycle hooks ──────────────────────────────────────────────────────────
register_activation_hook(  __FILE__, array( 'PoshPushCore', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'PoshPushCore', 'deactivate' ) );

/**
 * Bootstrap the plugin once all plugins are loaded.
 */
function posh_push_init() {
    load_plugin_textdomain( 'posh-push', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
    PoshPushCore::get_instance();
}
add_action( 'plugins_loaded', 'posh_push_init' );
