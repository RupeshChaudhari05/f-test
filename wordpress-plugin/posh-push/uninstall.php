<?php
/**
 * Posh Push Uninstall Script
 * ==========================
 * Runs when the user deletes the plugin from the WordPress admin panel
 * (Plugins → Delete). This script removes all plugin data from the database
 * so there are no orphaned records after uninstall.
 *
 * WordPress only calls this file when:
 *   1. The plugin is being deleted (not deactivated).
 *   2. The file is named uninstall.php and lives in the plugin root.
 *
 * @package PoshPush
 * @since   2.0.0
 */

// Security: abort if WordPress did not trigger this file.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
    exit;
}

// Remove all plugin options
delete_option( 'posh_push_settings' );
delete_option( 'posh_push_activated_at' );

// Clean up any transients the plugin may have set
delete_transient( 'posh_push_stats' );
delete_transient( 'posh_push_site_config' );

// For multisite installations: remove options from all sites
if ( is_multisite() ) {
    global $wpdb;

    // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
    $site_ids = $wpdb->get_col( "SELECT blog_id FROM {$wpdb->blogs}" );

    foreach ( $site_ids as $site_id ) {
        switch_to_blog( (int) $site_id );
        delete_option( 'posh_push_settings' );
        delete_option( 'posh_push_activated_at' );
        delete_transient( 'posh_push_stats' );
        restore_current_blog();
    }
}
